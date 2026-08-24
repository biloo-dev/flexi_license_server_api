import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { IccidService } from '../../crypto/iccid.service';
import { LicenseGeneratorService } from '../../crypto/license-generator.service';
import { CustomersService } from '../customers/customers.service';
import { OperatorsService } from '../operators/operators.service';
import { ModemsService } from '../modems/modems.service';
import { AuditService } from '../audit/audit.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import {
  CreateSimDto,
  BindSimDto,
  UpdateSimStatusDto,
} from './dto/create-sim.dto';

export interface SimCardDoc {
  id: string;
  customerId: string;
  operatorId: string;
  iccidHash: string;
  iccidLast4: string;
  phoneNumber: string | null;
  status: 'pending' | 'active' | 'blocked' | 'suspended' | 'expired' | 'revoked';
  requiredForAccess: boolean;
  activatedAt: any;
  blockedAt: any;
  createdAt: any;
  updatedAt: any;
}

export interface SimBindingDoc {
  id: string;
  simCardId: string;
  modemId: string;
  slot: number;
  status: 'active' | 'unbound';
  assignedAt: any;
  removedAt: any;
}

@Injectable()
export class SimsService {
  private readonly logger = new Logger(SimsService.name);
  private readonly collectionName = 'sim_cards';
  private readonly bindingsCollection = 'sim_bindings';

  constructor(
    private readonly firestore: FirestoreService,
    private readonly iccidService: IccidService,
    private readonly licenseGenerator: LicenseGeneratorService,
    private readonly customersService: CustomersService,
    private readonly operatorsService: OperatorsService,
    private readonly modemsService: ModemsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateSimDto): Promise<SimCardDoc> {
    await this.customersService.findById(dto.customerId);
    await this.operatorsService.findById(dto.operatorId);

    const iccidHash = this.iccidService.hashIccid(dto.iccid);
    const iccidLast4 = this.iccidService.getLast4(dto.iccid);

    // Check if ICCID hash already registered
    const existing = await this.firestore.findOne<SimCardDoc>(this.collectionName, [
      { field: 'iccidHash', op: '==', value: iccidHash },
    ]);

    if (existing) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `SIM card with ICCID ending in ${iccidLast4} is already registered in the system`,
      );
    }

    const docData = {
      customerId: dto.customerId,
      operatorId: dto.operatorId.toLowerCase(),
      iccidHash,
      iccidLast4,
      phoneNumber: dto.phoneNumber || null,
      status: dto.status || 'pending',
      requiredForAccess: dto.requiredForAccess ?? true,
      activatedAt: null,
      blockedAt: null,
      createdAt: this.firestore.serverTimestamp,
      updatedAt: this.firestore.serverTimestamp,
    };

    const id = await this.firestore.addDoc(this.collectionName, docData);

    await this.auditService.logEvent({
      simCardId: id,
      customerId: dto.customerId,
      event: 'SIM_REGISTERED',
      metadata: {
        operatorId: dto.operatorId,
        iccidLast4,
        requiredForAccess: docData.requiredForAccess,
      },
    });

    return { id, ...docData } as SimCardDoc;
  }

  async findAll(customerId?: string, status?: string): Promise<SimCardDoc[]> {
    const filters: import('../../database/firebase/firestore.service').QueryFilter[] = [];
    if (customerId) {
      filters.push({ field: 'customerId', op: '==' as const, value: customerId });
    }
    if (status) {
      filters.push({ field: 'status', op: '==' as const, value: status });
    }
    return this.firestore.find<SimCardDoc>(this.collectionName, filters);
  }

  async findById(id: string): Promise<SimCardDoc> {
    const doc = await this.firestore.getDoc<SimCardDoc>(this.collectionName, id);
    if (!doc) {
      throw new BusinessException(
        ErrorCode.SIM_NOT_FOUND,
        `SIM card '${id}' not found`,
      );
    }
    return doc;
  }

  async findByIccidHash(iccidHash: string): Promise<SimCardDoc | null> {
    return this.firestore.findOne<SimCardDoc>(this.collectionName, [
      { field: 'iccidHash', op: '==', value: iccidHash },
    ]);
  }

  async bindToModem(simId: string, dto: BindSimDto): Promise<SimBindingDoc> {
    const sim = await this.findById(simId);
    const modem = await this.modemsService.findById(dto.modemId);

    // Deactivate previous active bindings for this SIM
    const existingBindings = await this.firestore.find<SimBindingDoc>(
      this.bindingsCollection,
      [
        { field: 'simCardId', op: '==', value: simId },
        { field: 'status', op: '==', value: 'active' },
      ],
    );

    for (const b of existingBindings) {
      await this.firestore.updateDoc(this.bindingsCollection, b.id, {
        status: 'unbound',
        removedAt: this.firestore.serverTimestamp,
      });
    }

    const bindingData = {
      simCardId: simId,
      modemId: dto.modemId,
      slot: dto.slot || 1,
      status: 'active',
      assignedAt: this.firestore.serverTimestamp,
      removedAt: null,
    };

    const bindingId = await this.firestore.addDoc(this.bindingsCollection, bindingData);

    await this.auditService.logEvent({
      simCardId: simId,
      deviceId: modem.deviceId,
      customerId: sim.customerId,
      event: 'SIM_BOUND_TO_MODEM',
      metadata: {
        modemId: dto.modemId,
        imei: modem.imei,
        slot: bindingData.slot,
      },
    });

    return { id: bindingId, ...bindingData } as SimBindingDoc;
  }

  async getActiveBindingForSim(simId: string): Promise<SimBindingDoc | null> {
    return this.firestore.findOne<SimBindingDoc>(this.bindingsCollection, [
      { field: 'simCardId', op: '==', value: simId },
      { field: 'status', op: '==', value: 'active' },
    ]);
  }

  async updateStatus(id: string, dto: UpdateSimStatusDto): Promise<SimCardDoc> {
    const sim = await this.findById(id);
    const updatePayload: Record<string, any> = {
      status: dto.status,
      updatedAt: this.firestore.serverTimestamp,
    };

    if (dto.status === 'blocked') {
      updatePayload.blockedAt = this.firestore.serverTimestamp;
    } else if (dto.status === 'active' && !sim.activatedAt) {
      updatePayload.activatedAt = this.firestore.serverTimestamp;
    }

    await this.firestore.updateDoc(this.collectionName, id, updatePayload);

    await this.auditService.logEvent({
      simCardId: id,
      customerId: sim.customerId,
      event: `SIM_STATUS_${dto.status.toUpperCase()}`,
      metadata: { previousStatus: sim.status, newStatus: dto.status },
    });

    return this.findById(id);
  }

  async update(id: string, dto: import('./dto/create-sim.dto').UpdateSimDto): Promise<SimCardDoc> {
    const sim = await this.findById(id);
    const updateData: Record<string, any> = {
      updatedAt: this.firestore.serverTimestamp,
    };

    if (dto.phoneNumber !== undefined) {
      updateData.phoneNumber = dto.phoneNumber.trim();
    }
    if (dto.operatorId !== undefined) {
      updateData.operatorId = dto.operatorId.toLowerCase();
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }
    if (dto.iccid && dto.iccid.trim().length > 0) {
      const cleanIccid = dto.iccid.trim();
      updateData.iccidHash = this.iccidService.hashIccid(cleanIccid);
      updateData.iccidLast4 = this.iccidService.getLast4(cleanIccid);
    }

    await this.firestore.updateDoc(this.collectionName, id, updateData);
    await this.auditService.logEvent({
      simCardId: id,
      customerId: sim.customerId,
      event: 'SIM_UPDATED',
      metadata: { ...dto },
    });

    return this.findById(id);
  }

  async transferOwnership(id: string, newCustomerId: string): Promise<SimCardDoc> {
    const sim = await this.findById(id);
    const newCustomer = await this.customersService.findById(newCustomerId);

    if (sim.customerId === newCustomerId) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `La carte SIM appartient déjà au client '${newCustomer.name}'.`,
      );
    }

    const previousCustomerId = sim.customerId;
    const operator = await this.operatorsService.findById(sim.operatorId);

    // 1. Transfer and re-sign all licenses for this SIM to the new customer
    const licensesByCardId = await this.firestore.find<any>('licenses', [
      { field: 'simCardId', op: '==', value: id },
    ]);
    const licensesBySimId = await this.firestore.find<any>('licenses', [
      { field: 'simId', op: '==', value: id },
    ]);
    const allLicenses = [...licensesByCardId, ...licensesBySimId];
    const processedLicenseIds = new Set<string>();

    for (const lic of allLicenses) {
      if (processedLicenseIds.has(lic.id)) continue;
      processedLicenseIds.add(lic.id);

      // Generate a new Ed25519 signed serial for the new customer
      const generated = await this.licenseGenerator.generateLicense({
        licenseId: lic.licenseId || lic.id,
        simId: id,
        operator: operator.code,
        iccidHash: sim.iccidHash,
        deviceId: '*',
        validityDays: 365,
      });

      await this.firestore.updateDoc('licenses', lic.id, {
        customerId: newCustomerId,
        licenseSerial: generated.serial,
        keyId: generated.payload.kid,
        expiresAt: generated.expiresAt,
        status: 'pending',
        revokedAt: null,
        updatedAt: this.firestore.serverTimestamp,
      });

      await this.auditService.logEvent({
        licenseId: lic.id,
        simCardId: id,
        customerId: newCustomerId,
        event: 'LICENSE_TRANSFERRED',
        metadata: {
          previousCustomerId,
          newCustomerId,
          newCustomerName: newCustomer.name,
          newSerialGenerated: true,
        },
      });
    }

    // 2. Unbind from modems
    const existingBindings = await this.firestore.find<SimBindingDoc>(
      this.bindingsCollection,
      [
        { field: 'simCardId', op: '==', value: id },
        { field: 'status', op: '==', value: 'active' },
      ],
    );
    for (const b of existingBindings) {
      await this.firestore.updateDoc(this.bindingsCollection, b.id, {
        status: 'unbound',
        removedAt: this.firestore.serverTimestamp,
      });
    }

    // 3. Update SIM customer ID and reset status to pending (ready for new customer activation)
    await this.firestore.updateDoc(this.collectionName, id, {
      customerId: newCustomerId,
      status: 'pending',
      activatedAt: null,
      updatedAt: this.firestore.serverTimestamp,
    });

    // 4. Log Audit Event
    await this.auditService.logEvent({
      simCardId: id,
      customerId: newCustomerId,
      event: 'SIM_TRANSFERRED',
      metadata: {
        previousCustomerId,
        newCustomerId,
        newCustomerName: newCustomer.name,
        transferredLicensesCount: processedLicenseIds.size,
      },
    });

    return this.findById(id);
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const sim = await this.findById(id);

    // 1. Delete all licenses associated with this SIM (by simCardId or simId)
    const licensesByCardId = await this.firestore.find<any>('licenses', [
      { field: 'simCardId', op: '==', value: id },
    ]);
    const licensesBySimId = await this.firestore.find<any>('licenses', [
      { field: 'simId', op: '==', value: id },
    ]);
    const allLicenses = [...licensesByCardId, ...licensesBySimId];
    const deletedLicenseIds = new Set<string>();

    for (const lic of allLicenses) {
      if (deletedLicenseIds.has(lic.id)) continue;
      deletedLicenseIds.add(lic.id);
      await this.firestore.deleteDoc('licenses', lic.id);
      await this.auditService.logEvent({
        licenseId: lic.id,
        simCardId: id,
        customerId: sim.customerId,
        event: 'LICENSE_DELETED',
        metadata: {
          reason: 'SIM_CARD_DELETED',
          phoneNumber: sim.phoneNumber,
        },
      });
    }

    // 2. Delete bindings
    const bindings = await this.firestore.find<SimBindingDoc>(
      this.bindingsCollection,
      [{ field: 'simCardId', op: '==', value: id }],
    );
    for (const b of bindings) {
      await this.firestore.deleteDoc(this.bindingsCollection, b.id);
    }

    // 3. Delete SIM document
    await this.firestore.deleteDoc(this.collectionName, id);

    // 4. Log Audit event
    await this.auditService.logEvent({
      simCardId: id,
      customerId: sim.customerId,
      event: 'SIM_DELETED',
      metadata: {
        iccidLast4: sim.iccidLast4,
        operatorId: sim.operatorId,
        phoneNumber: sim.phoneNumber,
      },
    });

    return { success: true, message: `SIM ${id} deleted successfully` };
  }
}
