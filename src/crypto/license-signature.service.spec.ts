import { LicenseSignatureService, LicensePayload } from './license-signature.service';
import { CanonicalJsonService } from './canonical-json.service';

describe('LicenseSignatureService', () => {
  let service: LicenseSignatureService;
  let canonicalJson: CanonicalJsonService;

  beforeEach(() => {
    canonicalJson = new CanonicalJsonService();
    service = new LicenseSignatureService(canonicalJson);
  });

  it('should build and parse serial correctly in FX1 format', () => {
    const payload: LicensePayload = {
      v: 1,
      kid: '2026-01',
      licenseId: 'lic-12345',
      simId: 'sim-67890',
      operator: 'DJZ',
      iccidHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      deviceId: 'dev-pc-main',
      features: ['FLEXI'],
      iat: 1787130000,
      exp: 1818666000,
    };

    const dummySig = Buffer.alloc(64, 0xab);
    const serial = service.buildSerial(payload, dummySig);

    expect(serial.startsWith('FX1.')).toBe(true);
    expect(serial.split('.').length).toBe(3);

    const parsed = service.parseSerial(serial);
    expect(parsed.prefix).toBe('FX1');
    expect(parsed.payload.licenseId).toBe(payload.licenseId);
    expect(parsed.payload.operator).toBe(payload.operator);
    expect(parsed.payload.iccidHash).toBe(payload.iccidHash);
    expect(parsed.signatureBuffer).toEqual(dummySig);
  });

  it('should throw error on invalid serial structure or prefix', () => {
    expect(() => service.parseSerial('INVALID.SERIAL')).toThrow();
    expect(() => service.parseSerial('FX2.invalid.payload')).toThrow();
  });
});
