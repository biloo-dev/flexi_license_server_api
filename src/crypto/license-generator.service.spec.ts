import { ConfigService } from '@nestjs/config';
import { LicenseGeneratorService } from './license-generator.service';
import { LicenseVerifierService } from './license-verifier.service';
import { CanonicalJsonService } from './canonical-json.service';
import { Ed25519Service } from './ed25519.service';
import { IccidService } from './iccid.service';
import { LicenseSignatureService } from './license-signature.service';
import { FirestoreService } from '../database/firebase/firestore.service';

describe('LicenseGeneratorService & LicenseVerifierService', () => {
  let generator: LicenseGeneratorService;
  let verifier: LicenseVerifierService;
  let ed25519: Ed25519Service;
  let iccidService: IccidService;
  let canonicalJson: CanonicalJsonService;
  let signatureService: LicenseSignatureService;
  let keyPair: { publicKey: string; privateKey: string };

  const mockFirestoreService = {
    getDoc: jest.fn(),
    findOne: jest.fn(),
  } as unknown as FirestoreService;

  beforeEach(() => {
    ed25519 = new Ed25519Service();
    keyPair = ed25519.generateKeyPair();
    canonicalJson = new CanonicalJsonService();
    iccidService = new IccidService();
    signatureService = new LicenseSignatureService(canonicalJson);

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'license.activeKeyId') return '2026-01';
        if (key === 'license.privateKey') return keyPair.privateKey;
        if (key === 'license.publicKey') return keyPair.publicKey;
        if (key === 'license.defaultValidityDays') return 365;
        return null;
      }),
    } as unknown as ConfigService;

    generator = new LicenseGeneratorService(
      mockConfigService,
      canonicalJson,
      ed25519,
      iccidService,
      signatureService,
    );

    verifier = new LicenseVerifierService(
      mockConfigService,
      canonicalJson,
      ed25519,
      iccidService,
      signatureService,
      mockFirestoreService,
    );
  });

  it('should generate a valid Ed25519 signed license and successfully verify it', async () => {
    const rawIccid = '89213012345678901234';
    const deviceId = 'dev-pc-main-01';
    const licenseId = 'lic-test-001';

    const result = await generator.generateLicense({
      licenseId,
      simId: 'sim-djezzy-01',
      operator: 'DJZ',
      rawIccid,
      deviceId,
      validityDays: 365,
    });

    expect(result.serial).toBeDefined();
    expect(result.serial.startsWith('FX1.')).toBe(true);

    // Verify without DB check
    const verification = await verifier.verify(result.serial, {
      deviceId,
      detectedIccid: rawIccid,
      operatorCode: 'DJZ',
      checkDatabase: false,
    });

    expect(verification.valid).toBe(true);
    expect(verification.payload.licenseId).toBe(licenseId);
    expect(verification.payload.operator).toBe('DJZ');
    expect(verification.payload.deviceId).toBe(deviceId);
  });

  it('should fail verification if ICCID does not match', async () => {
    const rawIccid = '89213012345678901234';
    const deviceId = 'dev-pc-main-01';

    const result = await generator.generateLicense({
      licenseId: 'lic-002',
      simId: 'sim-02',
      operator: 'MOB',
      rawIccid,
      deviceId,
    });

    await expect(
      verifier.verify(result.serial, {
        deviceId,
        detectedIccid: '89213012345678909999', // Wrong ICCID
        checkDatabase: false,
      }),
    ).rejects.toThrow();
  });

  it('should fail verification if Device ID does not match', async () => {
    const rawIccid = '89213012345678901234';
    const deviceId = 'dev-pc-main-01';

    const result = await generator.generateLicense({
      licenseId: 'lic-003',
      simId: 'sim-03',
      operator: 'OOR',
      rawIccid,
      deviceId,
    });

    await expect(
      verifier.verify(result.serial, {
        deviceId: 'different-device-id',
        detectedIccid: rawIccid,
        checkDatabase: false,
      }),
    ).rejects.toThrow();
  });

  it('should fail verification if license has expired', async () => {
    const rawIccid = '89213012345678901234';
    const deviceId = 'dev-pc-01';

    // Generate expired license (validityDays: -1)
    const result = await generator.generateLicense({
      licenseId: 'lic-expired',
      simId: 'sim-04',
      operator: 'DJZ',
      rawIccid,
      deviceId,
      validityDays: -1,
    });

    await expect(
      verifier.verify(result.serial, {
        deviceId,
        detectedIccid: rawIccid,
        checkDatabase: false,
      }),
    ).rejects.toThrow();
  });
});
