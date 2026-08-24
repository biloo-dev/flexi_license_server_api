import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface KeyPairResult {
  publicKey: string; // PEM format
  privateKey: string; // PEM format
  publicKeyRawBase64: string; // 32-byte raw public key in Base64
}

@Injectable()
export class Ed25519Service {
  private readonly logger = new Logger(Ed25519Service.name);

  /**
   * Generates a new Ed25519 key pair in PKCS8 / SPKI PEM format.
   */
  generateKeyPair(): KeyPairResult {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const pubKeyObj = crypto.createPublicKey(publicKey);
    const pubKeyDer = pubKeyObj.export({ type: 'spki', format: 'der' });
    // In SPKI DER format for Ed25519, the last 32 bytes are the raw public key
    const rawPublicKey = pubKeyDer.subarray(pubKeyDer.length - 32);

    return {
      publicKey,
      privateKey,
      publicKeyRawBase64: rawPublicKey.toString('base64'),
    };
  }

  /**
   * Signs input data buffer using an Ed25519 private key (PEM or KeyObject).
   * Returns the raw 64-byte signature buffer.
   */
  sign(data: Buffer | string, privateKeyPemOrObj: string | crypto.KeyObject): Buffer {
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
    let key: crypto.KeyObject;

    if (typeof privateKeyPemOrObj === 'string') {
      let pem = privateKeyPemOrObj.trim();
      if (!pem.startsWith('-----BEGIN')) {
        // Assume raw base64 or pkcs8
        pem = `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`;
      }
      key = crypto.createPrivateKey(pem);
    } else {
      key = privateKeyPemOrObj;
    }

    return crypto.sign(null, dataBuffer, key);
  }

  /**
   * Verifies an Ed25519 signature against data and public key.
   */
  verify(
    data: Buffer | string,
    signature: Buffer,
    publicKeyPemOrRaw: string | crypto.KeyObject,
  ): boolean {
    try {
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
      let key: crypto.KeyObject;

      if (typeof publicKeyPemOrRaw === 'string') {
        const trimmed = publicKeyPemOrRaw.trim();
        if (trimmed.startsWith('-----BEGIN')) {
          key = crypto.createPublicKey(trimmed);
        } else {
          // If 32-byte raw public key in base64: construct SPKI wrapper
          // ASN.1 prefix for Ed25519 SPKI: 302a300506032b6570032100 + 32-byte key
          const rawBytes = Buffer.from(trimmed, 'base64');
          if (rawBytes.length === 32) {
            const prefix = Buffer.from('302a300506032b6570032100', 'hex');
            const der = Buffer.concat([prefix, rawBytes]);
            key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
          } else {
            const pem = `-----BEGIN PUBLIC KEY-----\n${trimmed}\n-----END PUBLIC KEY-----`;
            key = crypto.createPublicKey(pem);
          }
        }
      } else {
        key = publicKeyPemOrRaw;
      }

      return crypto.verify(null, dataBuffer, key, signature);
    } catch (err: any) {
      this.logger.debug(`Ed25519 verify failed: ${err.message}`);
      return false;
    }
  }
}
