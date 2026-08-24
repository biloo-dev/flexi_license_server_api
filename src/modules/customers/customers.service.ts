import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { AuditService } from '../audit/audit.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { CreateCustomerDto, UpdateCustomerStatusDto } from './dto/create-customer.dto';

export interface CustomerDoc {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  address: string | null;
  status: 'active' | 'suspended' | 'blocked' | 'deleted';
  createdAt: any;
  updatedAt: any;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);
  private readonly collectionName = 'customers';

  constructor(
    private readonly firestore: FirestoreService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCustomerDto): Promise<CustomerDoc> {
    const docData = {
      name: dto.name,
      phone: dto.phone,
      email: dto.email || null,
      company: dto.company || null,
      address: dto.address || null,
      status: dto.status || 'active',
      createdAt: this.firestore.serverTimestamp,
      updatedAt: this.firestore.serverTimestamp,
    };

    const id = await this.firestore.addDoc(this.collectionName, docData);
    this.logger.log(`Created customer ${id} in Firestore collection '${this.collectionName}'`);
    return { id, ...docData } as CustomerDoc;
  }

  async findAll(status?: string): Promise<CustomerDoc[]> {
    const filters = status ? [{ field: 'status', op: '==' as const, value: status }] : [];
    return this.firestore.find<CustomerDoc>(this.collectionName, filters);
  }

  async findById(id: string): Promise<CustomerDoc> {
    const doc = await this.firestore.getDoc<CustomerDoc>(this.collectionName, id);
    if (!doc || doc.status === 'deleted') {
      throw new BusinessException(
        ErrorCode.CUSTOMER_NOT_FOUND,
        `Customer '${id}' not found`,
      );
    }
    return doc;
  }

  async updateStatus(id: string, dto: UpdateCustomerStatusDto): Promise<CustomerDoc> {
    await this.findById(id);
    await this.firestore.updateDoc(this.collectionName, id, {
      status: dto.status,
      updatedAt: this.firestore.serverTimestamp,
    });
    return this.findById(id);
  }

  async update(id: string, dto: Partial<CreateCustomerDto>): Promise<CustomerDoc> {
    await this.findById(id);
    await this.firestore.updateDoc(this.collectionName, id, {
      ...dto,
      updatedAt: this.firestore.serverTimestamp,
    });
    return this.findById(id);
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const customer = await this.findById(id);

    // 1. Cascade delete all Licenses belonging to this customer
    const licenses = await this.firestore.find<any>('licenses', [
      { field: 'customerId', op: '==', value: id },
    ]);
    for (const lic of licenses) {
      await this.firestore.deleteDoc('licenses', lic.id);
      await this.auditService.logEvent({
        licenseId: lic.id,
        customerId: id,
        event: 'LICENSE_DELETED',
        metadata: { reason: 'CUSTOMER_DELETED', customerName: customer.name },
      });
    }

    // 2. Cascade delete all SIM cards belonging to this customer
    const sims = await this.firestore.find<any>('sim_cards', [
      { field: 'customerId', op: '==', value: id },
    ]);
    for (const s of sims) {
      // Unbind modems for this SIM
      const bindings = await this.firestore.find<any>('sim_bindings', [
        { field: 'simCardId', op: '==', value: s.id },
      ]);
      for (const b of bindings) {
        await this.firestore.deleteDoc('sim_bindings', b.id);
      }
      await this.firestore.deleteDoc('sim_cards', s.id);
      await this.auditService.logEvent({
        simCardId: s.id,
        customerId: id,
        event: 'SIM_DELETED',
        metadata: { reason: 'CUSTOMER_DELETED', phoneNumber: s.phoneNumber },
      });
    }

    // 3. Cascade unbind or delete Devices belonging to this customer
    const devices = await this.firestore.find<any>('devices', [
      { field: 'customerId', op: '==', value: id },
    ]);
    for (const dev of devices) {
      await this.firestore.deleteDoc('devices', dev.id);
    }

    // 4. Delete customer document
    await this.firestore.deleteDoc(this.collectionName, id);

    // 5. Audit Log
    await this.auditService.logEvent({
      customerId: id,
      event: 'CUSTOMER_DELETED',
      metadata: { name: customer.name, phone: customer.phone },
    });

    return {
      success: true,
      message: `Customer ${id} and all associated SIMs and licenses permanently deleted`,
    };
  }
}
