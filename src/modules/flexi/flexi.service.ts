import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { SimAuthorizationService } from '../sim-auth/sim-authorization.service';
import { IdempotencyService, OperationDoc } from './idempotency.service';
import { AuditService } from '../audit/audit.service';
import { OperatorsService } from '../operators/operators.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { LicenseEvent } from '../../common/constants/events.constant';
import { CreateFlexiOperationDto } from './dto/create-operation.dto';

export interface ExecuteFlexiResult {
  operationId: string;
  status: string;
  amount: number;
  phoneNumber: string;
  operator: string;
  idempotencyKey: string;
  duplicate: boolean;
  authorizedAt: string;
}

@Injectable()
export class FlexiService {
  private readonly logger = new Logger(FlexiService.name);
  private readonly collectionName = 'flexi_operations';

  constructor(
    private readonly firestore: FirestoreService,
    private readonly simAuthService: SimAuthorizationService,
    private readonly idempotencyService: IdempotencyService,
    private readonly operatorsService: OperatorsService,
    private readonly auditService: AuditService,
  ) {}

  async executeOperation(
    dto: CreateFlexiOperationDto,
  ): Promise<ExecuteFlexiResult> {
    // 1. Idempotency Check - prevent double recharge
    const existing = await this.idempotencyService.findExistingOperation(
      dto.idempotencyKey,
    );

    if (existing) {
      this.logger.warn(
        `[IDEMPOTENT] Duplicate operation detected for key: ${dto.idempotencyKey}. Returning previous result.`,
      );
      return {
        operationId: existing.id,
        status: existing.status,
        amount: existing.amount,
        phoneNumber: existing.phoneNumber,
        operator: existing.operatorId,
        idempotencyKey: existing.idempotencyKey,
        duplicate: true,
        authorizedAt: existing.createdAt?.toDate
          ? existing.createdAt.toDate().toISOString()
          : new Date().toISOString(),
      };
    }

    // 2. Resolve Operator
    const operator = await this.operatorsService.findById(dto.operatorId);

    // 3. CRITICAL RULE: Authorize SIM (Two-Level Authorization Engine)
    // NEVER execute operation before authorizeSim() succeeds!
    const authResult = await this.simAuthService.authorizeSim({
      customerId: dto.customerId,
      deviceId: dto.deviceId,
      simId: dto.simCardId,
      operatorCode: operator.code,
      detectedIccid: dto.detectedIccid,
      checkProgramAccess: true,
    });

    if (!authResult.authorized) {
      throw new BusinessException(
        ErrorCode.OPERATION_BLOCKED,
        'Flexi operation blocked: SIM authorization failed',
      );
    }

    // 4. Create Operation Record
    const operationData: Omit<OperationDoc, 'id'> = {
      customerId: dto.customerId,
      deviceId: dto.deviceId,
      simCardId: dto.simCardId,
      operatorId: dto.operatorId.toLowerCase(),
      phoneNumber: dto.phoneNumber,
      operationType: dto.operationType || 'flexi',
      amount: dto.amount,
      status: 'success',
      failureReason: null,
      idempotencyKey: dto.idempotencyKey,
      createdAt: this.firestore.serverTimestamp,
      completedAt: this.firestore.serverTimestamp,
    };

    const operationId = await this.firestore.addDoc(
      this.collectionName,
      operationData,
    );

    // 5. Audit Logging
    await this.auditService.logEvent({
      licenseId: authResult.license?.id,
      simCardId: dto.simCardId,
      deviceId: dto.deviceId,
      customerId: dto.customerId,
      event: 'FLEXI_OPERATION_COMPLETED',
      metadata: {
        operationId,
        amount: dto.amount,
        operator: operator.code,
        recipientPhone: dto.phoneNumber.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
        idempotencyKey: dto.idempotencyKey,
      },
    });

    return {
      operationId,
      status: 'success',
      amount: dto.amount,
      phoneNumber: dto.phoneNumber,
      operator: operator.code,
      idempotencyKey: dto.idempotencyKey,
      duplicate: false,
      authorizedAt: new Date().toISOString(),
    };
  }

  async findAll(filters: { customerId?: string; deviceId?: string; simCardId?: string } = {}): Promise<OperationDoc[]> {
    const queryFilters: import('../../database/firebase/firestore.service').QueryFilter[] = [];
    if (filters.customerId) {
      queryFilters.push({ field: 'customerId', op: '==' as const, value: filters.customerId });
    }
    if (filters.deviceId) {
      queryFilters.push({ field: 'deviceId', op: '==' as const, value: filters.deviceId });
    }
    if (filters.simCardId) {
      queryFilters.push({ field: 'simCardId', op: '==' as const, value: filters.simCardId });
    }
    return this.firestore.find<OperationDoc>(this.collectionName, queryFilters);
  }
}
