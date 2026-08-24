import { IccidService } from './iccid.service';

describe('IccidService', () => {
  let service: IccidService;

  beforeEach(() => {
    service = new IccidService();
  });

  it('should normalize and compute deterministic SHA256 hash of ICCID', () => {
    const raw1 = '89213012345678901234';
    const raw2 = ' 89213012345678901234 ';
    const raw3 = '8921-3012-3456-7890-1234';

    const hash1 = service.hashIccid(raw1);
    const hash2 = service.hashIccid(raw2);
    const hash3 = service.hashIccid(raw3);

    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(64); // SHA-256 hex string length
    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
  });

  it('should extract the last 4 digits accurately', () => {
    const last4 = service.getLast4('89213012345678907890');
    expect(last4).toBe('7890');
  });

  it('should verify detected ICCID against expected SHA256 hash', () => {
    const rawIccid = '89213012345678901234';
    const expectedHash = service.hashIccid(rawIccid);

    expect(service.verifyIccid(rawIccid, expectedHash)).toBe(true);
    expect(service.verifyIccid('89213012345678909999', expectedHash)).toBe(false);
  });
});
