import { FlexiService } from './flexi.service';
import { SimAuthorizationService } from '../sim-auth/sim-authorization.service';
import { IdempotencyService } from './idempotency.service';
import { OperatorsService } from '../operators/operators.service';
import { AuditService } from '../audit/audit.service';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { CreateFlexiOperationDto } from './dto/create-operation.dto';

describe('FlexiService', () => {
  let service: FlexiService;

  const mockFirestore = {
    addDoc: jest.fn().mockResolvedValue('op-doc-123'),
    serverTimestamp: 'TIMESTAMP',
  } as unknown as FirestoreService;

  const mockSimAuth = {
    authorizeSim: jest.fn(),
  } as unknown as SimAuthorizationService;

  const mockIdempotency = {
    findExistingOperation: jest.fn(),
  } as unknown as IdempotencyService;

  const mockOperators = {
    findById: jest.fn().mockResolvedValue({ id: 'djezzy', code: 'DJZ', name: 'Djezzy' }),
  } as unknown as OperatorsService;

  const mockAudit = {
    logEvent: jest.fn().mockResolvedValue('evt-456'),
  } as unknown as AuditService;

  beforeEach(() => {
    service = new FlexiService(
      mockFirestore,
      mockSimAuth,
      mockIdempotency,
      mockOperators,
      mockAudit,
    );
    jest.clearAllMocks();
  });

  it('should return cached result if idempotencyKey already exists', async () => {
    const dto: CreateFlexiOperationDto = {
      customerId: 'cust-1',
      deviceId: 'dev-1',
      simCardId: 'sim-1',
      operatorId: 'djezzy',
      phoneNumber: '0770123456',
      amount: 1000,
      detectedIccid: '89213012345678901234',
      idempotencyKey: 'idemp-duplicate-001',
    };

    (mockIdempotency.findExistingOperation as jest.Mock).mockResolvedValue({
      id: 'existing-op-1',
      status: 'success',
      amount: 1000,
      phoneNumber: '0770123456',
      operatorId: 'djezzy',
      idempotencyKey: 'idemp-duplicate-001',
      createdAt: { toDate: () => new Date() },
    });

    const result = await service.executeOperation(dto);

    expect(result.duplicate).toBe(true);
    expect(result.operationId).toBe('existing-op-1');
    // Ensure authorizeSim was not even called because it was cached
    expect(mockSimAuth.authorizeSim).not.toHaveBeenCalled();
  });

  it('should strictly call authorizeSim and execute recharge when authorized', async () => {
    const dto: CreateFlexiOperationDto = {
      customerId: 'cust-1',
      deviceId: 'dev-1',
      simCardId: 'sim-1',
      operatorId: 'djezzy',
      phoneNumber: '0770123456',
      amount: 1000,
      detectedIccid: '89213012345678901234',
      idempotencyKey: 'idemp-fresh-001',
    };

    (mockIdempotency.findExistingOperation as jest.Mock).mockResolvedValue(null);
    (mockSimAuth.authorizeSim as jest.Mock).mockResolvedValue({
      authorized: true,
      license: { id: 'lic-1' },
    });

    const result = await service.executeOperation(dto);

    expect(result.duplicate).toBe(false);
    expect(result.status).toBe('success');
    expect(result.operationId).toBe('op-doc-123');
    expect(mockSimAuth.authorizeSim).toHaveBeenCalledTimes(1);
    expect(mockFirestore.addDoc).toHaveBeenCalledTimes(1);
  });
});
