import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { DevicesService } from '../devices/devices.service';
import { ModemsService } from '../modems/modems.service';
import { SimsService } from '../sims/sims.service';
import { LicensesService } from '../licenses/licenses.service';
import { SimAuthorizationService } from '../sim-auth/sim-authorization.service';
import { Ed25519Service } from '../../crypto/ed25519.service';
import { CanonicalJsonService } from '../../crypto/canonical-json.service';
import { IccidService } from '../../crypto/iccid.service';
import { AuditService } from '../audit/audit.service';
import { Base64Url } from '../../common/utils/base64url.util';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { LicenseEvent } from '../../common/constants/events.constant';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly firestore: FirestoreService,
    private readonly devicesService: DevicesService,
    private readonly modemsService: ModemsService,
    private readonly simsService: SimsService,
    private readonly licensesService: LicensesService,
    private readonly simAuthService: SimAuthorizationService,
    private readonly ed25519: Ed25519Service,
    private readonly canonicalJson: CanonicalJsonService,
    private readonly iccidService: IccidService,
    private readonly auditService: AuditService,
  ) {}

  async processHeartbeat(dto: HeartbeatDto) {
    // 1. Verify or Auto-Register Device
    let device = await this.devicesService.findByUuid(dto.deviceUuid);
    if (!device) {
      try {
        device = await this.devicesService.findById(dto.deviceUuid);
      } catch {
        // Auto-register newly connected device
        device = await this.devicesService.register({
          customerId: 'unassigned',
          deviceUuid: dto.deviceUuid,
          deviceFingerprint: dto.deviceFingerprint || `FP-${dto.deviceUuid}`,
          name: `Client PC (${dto.deviceUuid.slice(-6)})`,
        });
      }
    }

    if (device.deviceFingerprint && device.deviceFingerprint !== dto.deviceFingerprint) {
      if (device.deviceFingerprint.startsWith('FP-dev-') || device.deviceFingerprint.startsWith('FP-')) {
        // Auto-update placeholder fingerprint to real client hardware fingerprint
        await this.firestore.updateDoc('devices', device.id, {
          deviceFingerprint: dto.deviceFingerprint,
          updatedAt: this.firestore.serverTimestamp,
        });
      } else {
        throw new BusinessException(
          ErrorCode.DEVICE_MISMATCH,
          'Device hardware fingerprint does not match server registration',
        );
      }
    }

    if (device.status !== 'active') {
      throw new BusinessException(
        ErrorCode.DEVICE_BLOCKED,
        `Device status is '${device.status}'`,
      );
    }

    // Update device lastSeenAt
    await this.firestore.updateDoc('devices', device.id, {
      lastSeenAt: this.firestore.serverTimestamp,
    });

    const simStatusMap: Record<string, { status: string; licenseStatus?: string; simId?: string; operator?: string; iccid?: string; port?: string }> = {};

    // 2. Evaluate all reported modems and SIMs
    for (const modemDto of dto.modems) {
      const opKey = modemDto.operator.toLowerCase();
      const rawNormalizedIccid = this.iccidService.normalize(modemDto.iccid);
      const detectedHash = this.iccidService.hashIccid(modemDto.iccid);

      // Lookup SIM by ICCID hash
      const sim = await this.simsService.findByIccidHash(detectedHash);

      let statusInfo: { status: string; licenseStatus?: string; simId?: string; operator?: string; iccid?: string; port?: string };

      if (!sim) {
        statusInfo = {
          status: 'unregistered',
          licenseStatus: 'none',
          simId: '',
          operator: opKey,
          iccid: rawNormalizedIccid,
          port: modemDto.port,
        };
      } else if (device.customerId && device.customerId !== 'unassigned' && sim.customerId !== device.customerId) {
        statusInfo = {
          status: 'mismatch_customer',
          licenseStatus: 'none',
          simId: sim.id,
          operator: opKey,
          iccid: rawNormalizedIccid,
          port: modemDto.port,
        };
      } else {
        if (!device.customerId || device.customerId === 'unassigned') {
          await this.firestore.updateDoc('devices', device.id, {
            customerId: sim.customerId,
            updatedAt: this.firestore.serverTimestamp,
          });
          device.customerId = sim.customerId;
        }
        // Check active license
        const license = await this.licensesService.findActiveBySimId(sim.id);
        let isLicenseValid = false;
        if (license && license.status === 'active') {
          const expiry = license.expiresAt?.toDate ? license.expiresAt.toDate() : new Date(license.expiresAt);
          if (expiry > new Date()) {
            isLicenseValid = true;
          }
        }

        if (sim.status === 'active' && isLicenseValid) {
          statusInfo = {
            status: 'active',
            licenseStatus: 'active',
            simId: sim.id,
            operator: opKey,
            iccid: rawNormalizedIccid,
            port: modemDto.port,
          };
        } else {
          statusInfo = {
            status: sim.status,
            licenseStatus: license ? license.status : 'none',
            simId: sim.id,
            operator: opKey,
            iccid: rawNormalizedIccid,
            port: modemDto.port,
          };
        }
      }

      // Store by multiple keys so client can look up uniquely per physical SIM:
      simStatusMap[rawNormalizedIccid] = statusInfo;
      simStatusMap[detectedHash] = statusInfo;
      if (modemDto.port) {
        simStatusMap[modemDto.port] = statusInfo;
      }
      simStatusMap[opKey] = statusInfo;
    }

    // 3. Level 1 Program Access check
    const programCheck = await this.simAuthService.checkProgramAccess(
      device.customerId,
    );

    const graceHours = this.configService.get<number>(
      'license.offlineGracePeriodHours',
      48,
    );

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expSeconds = nowSeconds + graceHours * 3600;

    // 4. Generate signed offline state token using Ed25519
    const statePayload = {
      v: 1,
      type: 'HEARTBEAT_STATE',
      deviceId: device.id,
      customerId: device.customerId,
      access: programCheck.access,
      sims: simStatusMap,
      iat: nowSeconds,
      exp: expSeconds,
    };

    const privateKey = this.configService.get<string>('license.privateKey');
    let signedStateToken = '';

    if (privateKey) {
      try {
        const canonical = this.canonicalJson.canonicalize(statePayload);
        const sig = this.ed25519.sign(canonical, privateKey);
        signedStateToken = `FXS1.${Base64Url.encode(canonical)}.${Base64Url.encode(sig)}`;
      } catch (err: any) {
        this.logger.warn(`Could not sign offline state token: ${err.message}`);
      }
    }

    // 5. Audit heartbeat
    await this.auditService.logEvent({
      deviceId: device.id,
      customerId: device.customerId,
      event: LicenseEvent.HEARTBEAT,
      metadata: {
        appVersion: dto.appVersion,
        modemsCount: dto.modems.length,
        programAccess: programCheck.access,
      },
    });

    return {
      access: programCheck.access,
      offlineGracePeriodHours: graceHours,
      signedStateToken,
      expiresAt: new Date(expSeconds * 1000).toISOString(),
      sims: simStatusMap,
    };
  }
}
