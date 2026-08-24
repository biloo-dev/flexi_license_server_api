import { Ed25519Service } from './ed25519.service';

describe('Ed25519Service', () => {
  let service: Ed25519Service;

  beforeEach(() => {
    service = new Ed25519Service();
  });

  it('should generate a valid Ed25519 key pair', () => {
    const keyPair = service.generateKeyPair();
    expect(keyPair.publicKey).toContain('BEGIN PUBLIC KEY');
    expect(keyPair.privateKey).toContain('BEGIN PRIVATE KEY');
    expect(keyPair.publicKeyRawBase64).toBeDefined();
    expect(Buffer.from(keyPair.publicKeyRawBase64, 'base64').length).toBe(32);
  });

  it('should sign and successfully verify data using generated key pair', () => {
    const keyPair = service.generateKeyPair();
    const data = Buffer.from('{"licenseId":"lic-123","status":"active"}', 'utf-8');

    const signature = service.sign(data, keyPair.privateKey);
    expect(signature).toBeDefined();
    expect(signature.length).toBe(64); // Ed25519 signatures are 64 bytes

    const isValid = service.verify(data, signature, keyPair.publicKey);
    expect(isValid).toBe(true);
  });

  it('should reject tampered or modified data', () => {
    const keyPair = service.generateKeyPair();
    const originalData = 'original_license_payload';
    const tamperedData = 'tampered_license_payload';

    const signature = service.sign(originalData, keyPair.privateKey);
    const isValid = service.verify(tamperedData, signature, keyPair.publicKey);

    expect(isValid).toBe(false);
  });

  it('should reject signature with wrong public key', () => {
    const keyPair1 = service.generateKeyPair();
    const keyPair2 = service.generateKeyPair();
    const data = 'some_data';

    const signature = service.sign(data, keyPair1.privateKey);
    const isValid = service.verify(data, signature, keyPair2.publicKey);

    expect(isValid).toBe(false);
  });
});
