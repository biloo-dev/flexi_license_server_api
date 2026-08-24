import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { LicenseGeneratorService } from '../../crypto/license-generator.service';
import { SimsService } from '../sims/sims.service';
import { DevicesService } from '../devices/devices.service';
import { CustomersService } from '../customers/customers.service';
import { OperatorsService } from '../operators/operators.service';
import { AuditService } from '../audit/audit.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { LicenseEvent } from '../../common/constants/events.constant';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { v4 as uuidv4 } from 'uuid';

export interface PaymentDoc {
  id: string;
  licenseId: string | null;
  customerId: string;
  simCardId: string;
  deviceId: string;
  amount: number;
  currency: string;
  reference: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  validityDays: number;
  paidAt: any;
  createdAt: any;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly collectionName = 'license_payments';

  constructor(
    private readonly firestore: FirestoreService,
    private readonly licenseGenerator: LicenseGeneratorService,
    private readonly simsService: SimsService,
    private readonly devicesService: DevicesService,
    private readonly customersService: CustomersService,
    private readonly operatorsService: OperatorsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePaymentDto): Promise<PaymentDoc> {
    await this.customersService.findById(dto.customerId);
    await this.simsService.findById(dto.simCardId);
    await this.devicesService.findById(dto.deviceId);

    // Check duplicate payment reference
    const existing = await this.firestore.findOne<PaymentDoc>(this.collectionName, [
      { field: 'reference', op: '==', value: dto.reference },
    ]);

    if (existing) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `Payment with reference '${dto.reference}' already exists`,
      );
    }

    const docData: Omit<PaymentDoc, 'id'> = {
      licenseId: null,
      customerId: dto.customerId,
      simCardId: dto.simCardId,
      deviceId: dto.deviceId,
      amount: dto.amount,
      currency: dto.currency || 'DZD',
      reference: dto.reference,
      status: 'pending',
      validityDays: dto.validityDays || 365,
      paidAt: null,
      createdAt: this.firestore.serverTimestamp,
    };

    const id = await this.firestore.addDoc(this.collectionName, docData);

    await this.auditService.logEvent({
      customerId: dto.customerId,
      simCardId: dto.simCardId,
      deviceId: dto.deviceId,
      event: LicenseEvent.PAYMENT_RECEIVED,
      metadata: {
        paymentId: id,
        reference: dto.reference,
        amount: dto.amount,
        currency: docData.currency,
      },
    });

    return { id, ...docData };
  }

  async confirmPayment(paymentId: string): Promise<{ payment: PaymentDoc; license: any; serial: string }> {
    const payment = await this.findById(paymentId);

    if (payment.status === 'paid') {
      throw new BusinessException(
        ErrorCode.PAYMENT_ALREADY_PROCESSED,
        `Payment '${paymentId}' is already marked as paid`,
      );
    }

    if (payment.status !== 'pending') {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `Cannot confirm payment with status '${payment.status}'`,
      );
    }

    const sim = await this.simsService.findById(payment.simCardId);
    const device = await this.devicesService.findById(payment.deviceId);
    const operator = await this.operatorsService.findById(sim.operatorId);

    const licenseId = `lic_${uuidv4()}`;

    // Cryptographically generate & sign the license with Ed25519
    const generated = await this.licenseGenerator.generateLicense({
      licenseId,
      simId: sim.id,
      operator: operator.code,
      iccidHash: sim.iccidHash,
      deviceId: device.id,
      validityDays: payment.validityDays || 365,
    });

    const licenseDoc = {
      licenseId,
      simCardId: sim.id,
      customerId: payment.customerId,
      deviceId: device.id,
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

    // Execute atomic Firestore transaction
    await this.firestore.runTransaction(async (transaction) => {
      const paymentRef = this.firestore.doc(this.collectionName, paymentId);
      const licenseRef = this.firestore.doc('licenses', licenseId);
      const simRef = this.firestore.doc('sim_cards', sim.id);

      transaction.update(paymentRef, {
        status: 'paid',
        licenseId,
        paidAt: this.firestore.serverTimestamp,
      });

      transaction.set(licenseRef, licenseDoc);

      transaction.update(simRef, {
        status: 'active',
        activatedAt: this.firestore.serverTimestamp,
        updatedAt: this.firestore.serverTimestamp,
      });
    });

    await this.auditService.logEvent({
      licenseId,
      simCardId: sim.id,
      deviceId: device.id,
      customerId: payment.customerId,
      event: LicenseEvent.PAYMENT_CONFIRMED,
      metadata: {
        paymentId,
        reference: payment.reference,
        amount: payment.amount,
        licenseSerial: generated.serial,
      },
    });

    const updatedPayment = await this.findById(paymentId);

    return {
      payment: updatedPayment,
      license: { id: licenseId, ...licenseDoc },
      serial: generated.serial,
    };
  }

  async findAll(customerId?: string, status?: string): Promise<PaymentDoc[]> {
    const filters: import('../../database/firebase/firestore.service').QueryFilter[] = [];
    if (customerId) {
      filters.push({ field: 'customerId', op: '==' as const, value: customerId });
    }
    if (status) {
      filters.push({ field: 'status', op: '==' as const, value: status });
    }
    return this.firestore.find<PaymentDoc>(this.collectionName, filters);
  }

  async findById(id: string): Promise<PaymentDoc> {
    const doc = await this.firestore.getDoc<PaymentDoc>(this.collectionName, id);
    if (!doc) {
      throw new BusinessException(
        ErrorCode.PAYMENT_NOT_FOUND,
        `Payment record '${id}' not found`,
      );
    }
    return doc;
  }
}
