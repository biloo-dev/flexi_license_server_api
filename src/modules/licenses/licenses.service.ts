import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { LicenseGeneratorService } from '../../crypto/license-generator.service';
import { SimsService } from '../sims/sims.service';
import { DevicesService } from '../devices/devices.service';
import { OperatorsService } from '../operators/operators.service';
import { AuditService } from '../audit/audit.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { LicenseEvent } from '../../common/constants/events.constant';
import { CreateLicenseDto, RenewLicenseDto } from './dto/create-license.dto';
import { v4 as uuidv4 } from 'uuid';

export interface LicenseDoc {
  id: string;
  licenseId: string;
  simCardId: string;
  customerId: string;
  deviceId: string;
  licenseSerial: string;
  serialNumber?: string;
  keyId: string;
  version: number;
  issuedAt: any;
  expiresAt: any;
  status: 'pending' | 'active' | 'expired' | 'revoked' | 'suspended';
  revokedAt: any;
  createdAt: any;
  updatedAt: any;
}

@Injectable()
export class LicensesService {
  private readonly logger = new Logger(LicensesService.name);
  private readonly collectionName = 'licenses';

  constructor(
    private readonly firestore: FirestoreService,
    private readonly licenseGenerator: LicenseGeneratorService,
    private readonly simsService: SimsService,
    private readonly devicesService: DevicesService,
    private readonly operatorsService: OperatorsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateLicenseDto): Promise<LicenseDoc> {
    const sim = await this.simsService.findById(dto.simCardId);
    const operator = await this.operatorsService.findById(sim.operatorId);

    let deviceId = dto.deviceId || '*';
    if (deviceId !== '*') {
      const device = await this.devicesService.findById(deviceId);
      if (sim.customerId !== device.customerId) {
        throw new BusinessException(
          ErrorCode.CUSTOMER_NOT_FOUND,
          `SIM customer ID (${sim.customerId}) does not match Device customer ID (${device.customerId})`,
        );
      }
    }

    // 🔒 Rule: A SIM card can have only ONE active license at a time.
    // Deactivate/Revoke any previous active licenses for this SIM card so that it is cleanly superseded.
    const existingActiveLicenses = await this.firestore.find<LicenseDoc>(this.collectionName, [
      { field: 'simCardId', op: '==', value: sim.id },
      { field: 'status', op: '==', value: 'active' },
    ]);

    for (const oldLic of existingActiveLicenses) {
      const oldId = oldLic.id || oldLic.licenseId;
      await this.firestore.updateDoc(this.collectionName, oldId, {
        status: 'revoked',
        revokedAt: this.firestore.serverTimestamp,
        revocationReason: 'Superseded by new license generation',
        updatedAt: this.firestore.serverTimestamp,
      });
      await this.auditService.logEvent({
        licenseId: oldId,
        simCardId: sim.id,
        deviceId: oldLic.deviceId,
        customerId: sim.customerId,
        event: LicenseEvent.LICENSE_REVOKED,
        metadata: { reason: 'Superseded by new license generation' },
      });
    }

    const licenseId = `lic_${uuidv4()}`;

    const generated = await this.licenseGenerator.generateLicense({
      licenseId,
      simId: sim.id,
      operator: operator.code,
      iccidHash: sim.iccidHash,
      deviceId: deviceId,
      features: dto.features || ['FLEXI'],
      validityDays: dto.validityDays || 365,
    });

    const docData: Omit<LicenseDoc, 'id'> = {
      licenseId,
      simCardId: sim.id,
      customerId: sim.customerId,
      deviceId: deviceId,
      licenseSerial: generated.serial,
      keyId: generated.payload.kid,
      version: generated.payload.v,
      issuedAt: this.firestore.serverTimestamp,
      expiresAt: generated.expiresAt,
      status: 'active',
      revokedAt: null,
      createdAt: this.firestore.serverTimestamp,
      updatedAt: this.firestore.serverTimestamp,
    };

    await this.firestore.setDoc(this.collectionName, licenseId, docData);

    await this.auditService.logEvent({
      licenseId,
      simCardId: sim.id,
      deviceId: deviceId,
      customerId: sim.customerId,
      event: LicenseEvent.LICENSE_CREATED,
      metadata: {
        keyId: generated.payload.kid,
        expiresAt: generated.expiresAt,
        operator: operator.code,
      },
    });

    return this.enrichLicense({
      id: licenseId,
      ...docData,
      serialNumber: generated.serial,
    } as any);
  }

  private async enrichLicense(doc: LicenseDoc): Promise<any> {
    const toIsoString = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (val instanceof Date) return val.toISOString();
      if (typeof val.toDate === 'function') return val.toDate().toISOString();
      if (val._seconds !== undefined) return new Date(val._seconds * 1000).toISOString();
      if (val.seconds !== undefined) return new Date(val.seconds * 1000).toISOString();
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    let customerName = doc.customerId ? `Customer (${doc.customerId})` : 'Unknown Customer';
    if (doc.customerId) {
      try {
        const cust = await this.firestore.getDoc<{ name?: string }>('customers', doc.customerId);
        if (cust?.name) {
          customerName = cust.name;
        }
      } catch (_) {}
    }

    let simPhone = 'N/A';
    let operator = 'MOBILIS';
    let iccidLast4 = 'N/A';
    let simStatus = 'deleted';
    let isSimActive = false;

    const simIdToLookup = doc.simCardId || (doc as any).simId;
    if (simIdToLookup) {
      try {
        const sim = await this.firestore.getDoc<{ phoneNumber?: string; operatorId?: string; iccidLast4?: string; status?: string }>('sim_cards', simIdToLookup);
        if (sim) {
          if (sim.phoneNumber) simPhone = sim.phoneNumber;
          if (sim.operatorId) operator = sim.operatorId.toUpperCase();
          if (sim.iccidLast4) iccidLast4 = sim.iccidLast4;
          simStatus = sim.status || 'pending';
          isSimActive = (simStatus === 'active');
        } else {
          simStatus = 'deleted';
          isSimActive = false;
        }
      } catch (_) {}
    }

    return {
      ...doc,
      id: doc.id || doc.licenseId,
      serialNumber: doc.licenseSerial,
      customerName,
      simPhone,
      operator,
      iccidLast4,
      simStatus,
      isSimActive,
      issuedAt: toIsoString(doc.issuedAt),
      expiresAt: toIsoString(doc.expiresAt),
      createdAt: toIsoString(doc.createdAt),
      updatedAt: toIsoString(doc.updatedAt),
      revokedAt: toIsoString(doc.revokedAt),
    };
  }

  async findAll(filters: { customerId?: string; simCardId?: string; status?: string } = {}): Promise<any[]> {
    const queryFilters: import('../../database/firebase/firestore.service').QueryFilter[] = [];
    if (filters.customerId) {
      queryFilters.push({ field: 'customerId', op: '==' as const, value: filters.customerId });
    }
    if (filters.simCardId) {
      queryFilters.push({ field: 'simCardId', op: '==' as const, value: filters.simCardId });
    }
    if (filters.status) {
      queryFilters.push({ field: 'status', op: '==' as const, value: filters.status });
    }

    const docs = await this.firestore.find<LicenseDoc>(this.collectionName, queryFilters);
    return Promise.all(docs.map((d) => this.enrichLicense(d)));
  }

  async findById(id: string): Promise<any> {
    const doc = await this.firestore.getDoc<LicenseDoc>(this.collectionName, id);
    if (!doc) {
      throw new BusinessException(
        ErrorCode.LICENSE_NOT_FOUND,
        `License '${id}' not found`,
      );
    }
    return this.enrichLicense(doc);
  }

  async findActiveBySimId(simId: string): Promise<LicenseDoc | null> {
    return this.firestore.findOne<LicenseDoc>(this.collectionName, [
      { field: 'simCardId', op: '==', value: simId },
      { field: 'status', op: '==', value: 'active' },
    ]);
  }

  async revoke(id: string, reason: string = 'Revoked by admin'): Promise<LicenseDoc> {
    const license = await this.findById(id);
    if (license.status === 'revoked') {
      return license;
    }

    await this.firestore.updateDoc(this.collectionName, id, {
      status: 'revoked',
      revokedAt: this.firestore.serverTimestamp,
      updatedAt: this.firestore.serverTimestamp,
    });

    await this.auditService.logEvent({
      licenseId: id,
      simCardId: license.simCardId,
      deviceId: license.deviceId,
      customerId: license.customerId,
      event: LicenseEvent.LICENSE_REVOKED,
      metadata: { reason },
    });

    return this.findById(id);
  }

  async suspend(id: string): Promise<LicenseDoc> {
    const license = await this.findById(id);
    await this.firestore.updateDoc(this.collectionName, id, {
      status: 'suspended',
      updatedAt: this.firestore.serverTimestamp,
    });

    await this.auditService.logEvent({
      licenseId: id,
      simCardId: license.simCardId,
      deviceId: license.deviceId,
      customerId: license.customerId,
      event: LicenseEvent.LICENSE_SUSPENDED,
    });

    return this.findById(id);
  }

  async reactivate(id: string): Promise<LicenseDoc> {
    const license = await this.findById(id);
    if (license.status === 'revoked') {
      throw new BusinessException(
        ErrorCode.LICENSE_REVOKED,
        'Cannot reactivate a revoked license. A new license must be issued.',
      );
    }

    await this.firestore.updateDoc(this.collectionName, id, {
      status: 'active',
      updatedAt: this.firestore.serverTimestamp,
    });

    await this.auditService.logEvent({
      licenseId: id,
      simCardId: license.simCardId,
      deviceId: license.deviceId,
      customerId: license.customerId,
      event: LicenseEvent.LICENSE_REACTIVATED,
    });

    return this.findById(id);
  }

  async renew(id: string, dto: RenewLicenseDto): Promise<LicenseDoc> {
    const license = await this.findById(id);
    if (license.status === 'revoked') {
      throw new BusinessException(
        ErrorCode.LICENSE_REVOKED,
        'Cannot renew a revoked license. A new license must be issued.',
      );
    }

    const sim = await this.simsService.findById(license.simCardId);
    const operator = await this.operatorsService.findById(sim.operatorId);
    const validityDays = dto.additionalDays || 365;

    const generated = await this.licenseGenerator.generateLicense({
      licenseId: license.licenseId,
      simId: license.simCardId,
      operator: operator.code,
      iccidHash: sim.iccidHash,
      deviceId: license.deviceId,
      validityDays,
    });

    await this.firestore.updateDoc(this.collectionName, id, {
      licenseSerial: generated.serial,
      keyId: generated.payload.kid,
      expiresAt: generated.expiresAt,
      status: 'active',
      updatedAt: this.firestore.serverTimestamp,
    });

    await this.auditService.logEvent({
      licenseId: id,
      simCardId: license.simCardId,
      deviceId: license.deviceId,
      customerId: license.customerId,
      event: LicenseEvent.LICENSE_RENEWED,
      metadata: {
        newKeyId: generated.payload.kid,
        newExpiresAt: generated.expiresAt,
        additionalDays: validityDays,
      },
    });

    return this.findById(id);
  }

  async regenerateSerial(id: string, validityDays: number = 365): Promise<LicenseDoc> {
    const license = await this.findById(id);
    const sim = await this.simsService.findById(license.simCardId);
    const operator = await this.operatorsService.findById(sim.operatorId);

    const generated = await this.licenseGenerator.generateLicense({
      licenseId: license.licenseId || id,
      simId: license.simCardId,
      operator: operator.code,
      iccidHash: sim.iccidHash,
      deviceId: license.deviceId || '*',
      validityDays,
    });

    await this.firestore.updateDoc(this.collectionName, id, {
      licenseSerial: generated.serial,
      keyId: generated.payload.kid,
      expiresAt: generated.expiresAt,
      status: 'active',
      revokedAt: null,
      updatedAt: this.firestore.serverTimestamp,
    });

    await this.auditService.logEvent({
      licenseId: id,
      simCardId: license.simCardId,
      deviceId: license.deviceId,
      customerId: license.customerId,
      event: 'LICENSE_SERIAL_REGENERATED',
      metadata: {
        newKeyId: generated.payload.kid,
        newExpiresAt: generated.expiresAt,
        validityDays,
      },
    });

    return this.findById(id);
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const license = await this.findById(id);
    await this.firestore.deleteDoc(this.collectionName, id);

    await this.auditService.logEvent({
      licenseId: id,
      simCardId: license.simCardId,
      deviceId: license.deviceId,
      customerId: license.customerId,
      event: 'LICENSE_DELETED',
      metadata: {
        licenseSerial: license.licenseSerial || license.serialNumber,
        reason: 'Permanently deleted by admin',
      },
    });

    return { success: true, message: `License ${id} permanently deleted` };
  }
}
