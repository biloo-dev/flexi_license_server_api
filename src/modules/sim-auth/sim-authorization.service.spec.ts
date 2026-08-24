import { SimAuthorizationService } from './sim-authorization.service';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { IccidService } from '../../crypto/iccid.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/constants/error-codes.constant';

describe('SimAuthorizationService', () => {
  let service: SimAuthorizationService;
  let iccidService: IccidService;

  const mockFirestore = {
    getDoc: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    addDoc: jest.fn(),
    serverTimestamp: 'MOCK_TIMESTAMP',
  } as unknown as FirestoreService;

  const mockAudit = {
    logEvent: jest.fn().mockResolvedValue('evt-123'),
  } as unknown as AuditService;

  beforeEach(() => {
    iccidService = new IccidService();
    service = new SimAuthorizationService(
      mockFirestore,
      iccidService,
      mockAudit,
    );
    jest.clearAllMocks();
  });

  it('should authorize SIM when all customer, device, modem, SIM, and license conditions are valid', async () => {
    const rawIccid = '89213012345678901234';
    const iccidHash = iccidService.hashIccid(rawIccid);

    (mockFirestore.getDoc as jest.Mock).mockImplementation((col: string, id: string) => {
      if (col === 'customers') return Promise.resolve({ id: 'cust-1', status: 'active' });
      if (col === 'devices') return Promise.resolve({ id: 'dev-1', customerId: 'cust-1', status: 'active' });
      if (col === 'sim_cards') return Promise.resolve({ id: 'sim-1', customerId: 'cust-1', operatorId: 'djezzy', iccidHash, status: 'active' });
      if (col === 'modems') return Promise.resolve({ id: 'modem-1', deviceId: 'dev-1', status: 'active' });
      if (col === 'operators') return Promise.resolve({ id: 'djezzy', code: 'DJZ', status: 'active' });
      return Promise.resolve(null);
    });

    (mockFirestore.find as jest.Mock).mockImplementation((col: string) => {
      if (col === 'sim_cards') return Promise.resolve([{ id: 'sim-1', status: 'active', requiredForAccess: true }]);
      return Promise.resolve([]);
    });

    (mockFirestore.findOne as jest.Mock).mockImplementation((col: string) => {
      if (col === 'sim_bindings') return Promise.resolve({ id: 'bind-1', simCardId: 'sim-1', modemId: 'modem-1', status: 'active' });
      if (col === 'licenses') return Promise.resolve({
        id: 'lic-1',
        simCardId: 'sim-1',
        deviceId: 'dev-1',
        status: 'active',
        expiresAt: new Date(Date.now() + 86400000), // tomorrow
      });
      return Promise.resolve(null);
    });

    const result = await service.authorizeSim({
      customerId: 'cust-1',
      deviceId: 'dev-1',
      simId: 'sim-1',
      operatorCode: 'DJZ',
      detectedIccid: rawIccid,
    });

    expect(result.authorized).toBe(true);
    expect(result.programAccess).toBe(true);
    expect(result.simAuthorized).toBe(true);
  });

  it('should block operation if customer is inactive', async () => {
    (mockFirestore.getDoc as jest.Mock).mockImplementation((col: string) => {
      if (col === 'customers') return Promise.resolve({ id: 'cust-1', status: 'suspended' });
      return Promise.resolve(null);
    });

    await expect(
      service.authorizeSim({
        customerId: 'cust-1',
        deviceId: 'dev-1',
        simId: 'sim-1',
      }),
    ).rejects.toThrow();
  });

  it('should block operation if SIM ICCID does not match', async () => {
    const rawIccid = '89213012345678901234';
    const correctHash = iccidService.hashIccid(rawIccid);

    (mockFirestore.getDoc as jest.Mock).mockImplementation((col: string) => {
      if (col === 'customers') return Promise.resolve({ id: 'cust-1', status: 'active' });
      if (col === 'devices') return Promise.resolve({ id: 'dev-1', customerId: 'cust-1', status: 'active' });
      if (col === 'sim_cards') return Promise.resolve({ id: 'sim-1', customerId: 'cust-1', operatorId: 'djezzy', iccidHash: correctHash, status: 'active' });
      if (col === 'modems') return Promise.resolve({ id: 'modem-1', deviceId: 'dev-1', status: 'active' });
      return Promise.resolve(null);
    });

    (mockFirestore.find as jest.Mock).mockResolvedValue([]);
    (mockFirestore.findOne as jest.Mock).mockImplementation((col: string) => {
      if (col === 'sim_bindings') return Promise.resolve({ id: 'bind-1', simCardId: 'sim-1', modemId: 'modem-1', status: 'active' });
      return Promise.resolve(null);
    });

    await expect(
      service.authorizeSim({
        customerId: 'cust-1',
        deviceId: 'dev-1',
        simId: 'sim-1',
        detectedIccid: '89213012345678909999', // Mismatched ICCID
      }),
    ).rejects.toThrow();
  });
});
