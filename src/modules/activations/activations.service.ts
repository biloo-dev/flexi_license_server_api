import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { LicenseVerifierService } from '../../crypto/license-verifier.service';
import { LicenseSignatureService } from '../../crypto/license-signature.service';
import { IccidService } from '../../crypto/iccid.service';
import { SimsService } from '../sims/sims.service';
import { DevicesService } from '../devices/devices.service';
import { ModemsService } from '../modems/modems.service';
import { AuditService } from '../audit/audit.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { LicenseEvent } from '../../common/constants/events.constant';
import { ActivateLicenseDto } from './dto/activate-license.dto';

export interface ActivationDoc {
  id: string;
  licenseId: string;
  simCardId: string;
  deviceId: string;
  modemId: string;
  detectedIccidHash: string;
  appVersion: string;
  status: 'success' | 'failed';
  activatedAt: any;
  createdAt: any;
}

@Injectable()
export class ActivationsService {
  private readonly logger = new Logger(ActivationsService.name);
  private readonly collectionName = 'license_activations';

  constructor(
    private readonly firestore: FirestoreService,
    private readonly verifier: LicenseVerifierService,
    private readonly signatureService: LicenseSignatureService,
    private readonly iccidService: IccidService,
    private readonly simsService: SimsService,
    private readonly devicesService: DevicesService,
    private readonly modemsService: ModemsService,
    private readonly auditService: AuditService,
  ) {}

  async activate(dto: ActivateLicenseDto): Promise<any> {
    // 1. Parse Serial Payload to resolve SIM and customer
    const parsed = this.signatureService.parseSerial(dto.licenseSerial);
    const payload = parsed.payload;

    // 2. Resolve SIM
    const sim = await this.simsService.findById(payload.simId);
    if (sim.status === 'suspended') {
      throw new BusinessException(
        ErrorCode.SIM_BLOCKED,
        `SIM card is ${sim.status}`,
      );
    }

    // 3. Resolve or Auto-Register Device
    let device = await this.devicesService.findByUuid(dto.deviceId);
    if (!device) {
      try {
        device = await this.devicesService.findById(dto.deviceId);
      } catch {
        device = await this.devicesService.register({
          customerId: sim.customerId,
          deviceUuid: dto.deviceId,
          deviceFingerprint: `FP-${dto.deviceId}`,
          name: `Client PC (${dto.deviceId.slice(-6)})`,
        });
      }
    }

    // 🔒 Enforce Single-Customer Device Isolation:
    if (device.customerId && device.customerId !== 'unassigned' && device.customerId !== sim.customerId) {
      throw new BusinessException(
        ErrorCode.CUSTOMER_MISMATCH,
        `Cette carte SIM appartient à un autre client. Cet appareil (${device.name || device.deviceUuid}) est déjà rattaché à un client différent. Un même programme ne peut pas mélanger les puces de plusieurs clients.`,
      );
    }

    if (!device.customerId || device.customerId === 'unassigned') {
      await this.firestore.updateDoc('devices', device.id, {
        customerId: sim.customerId,
        updatedAt: this.firestore.serverTimestamp,
      });
      device.customerId = sim.customerId;
    }

    if (device.status !== 'active') {
      throw new BusinessException(
        ErrorCode.DEVICE_BLOCKED,
        `Device status is '${device.status}'. Only active devices can activate licenses.`,
      );
    }

    // 4. Resolve or Register Modem
    let modem = await this.modemsService.findByImei(dto.imei);
    if (!modem) {
      modem = await this.modemsService.register({
        deviceId: device.id,
        imei: dto.imei,
        name: `Modem ${dto.imei.slice(-4)}`,
      });
    }

    if (modem.status === 'blocked') {
      throw new BusinessException(
        ErrorCode.MODEM_BLOCKED,
        `Modem '${dto.imei}' is blocked`,
      );
    }

    const detectedIccidHash = this.iccidService.hashIccid(dto.iccid);

    // 5. Cryptographically verify Ed25519 signature & 12 points
    const verification = await this.verifier.verify(dto.licenseSerial, {
      deviceId: device.id,
      deviceUuid: device.deviceUuid,
      customerId: sim.customerId,
      detectedIccid: dto.iccid,
      checkDatabase: true,
    });

    // 6. Ensure SIM is bound to this modem
    await this.simsService.bindToModem(sim.id, {
      modemId: modem.id,
      slot: 1,
    });

    // 7. Update SIM and License status to active
    await this.simsService.updateStatus(sim.id, { status: 'active' });
    await this.firestore.updateDoc('licenses', payload.licenseId, {
      deviceId: device.id,
      status: 'active',
      updatedAt: this.firestore.serverTimestamp,
    });

    // 7. Record Activation document
    const activationData: Omit<ActivationDoc, 'id'> = {
      licenseId: payload.licenseId,
      simCardId: sim.id,
      deviceId: device.id,
      modemId: modem.id,
      detectedIccidHash,
      appVersion: dto.appVersion || '1.0.0',
      status: 'success',
      activatedAt: this.firestore.serverTimestamp,
      createdAt: this.firestore.serverTimestamp,
    };

    const activationId = await this.firestore.addDoc(
      this.collectionName,
      activationData,
    );

    // 8. Audit event
    await this.auditService.logEvent({
      licenseId: payload.licenseId,
      simCardId: sim.id,
      deviceId: device.id,
      customerId: sim.customerId,
      event: LicenseEvent.LICENSE_ACTIVATED,
      metadata: {
        activationId,
        operator: payload.operator,
        appVersion: dto.appVersion,
        modemImei: dto.imei,
      },
    });

    return {
      activated: true,
      activationId,
      licenseId: payload.licenseId,
      simId: sim.id,
      operator: payload.operator,
      deviceId: device.id,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      features: payload.features,
    };
  }

  async findAll(deviceId?: string): Promise<ActivationDoc[]> {
    const filters = deviceId
      ? [{ field: 'deviceId', op: '==' as const, value: deviceId }]
      : [];
    return this.firestore.find<ActivationDoc>(this.collectionName, filters);
  }
}
