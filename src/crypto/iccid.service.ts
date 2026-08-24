import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class IccidService {
  /**
   * Cleans and normalizes an ICCID string (removes whitespace, uppercase, etc.)
   */
  normalize(rawIccid: string): string {
    if (!rawIccid) return '';
    return rawIccid.trim().replace(/[\s-]/g, '').toUpperCase();
  }

  /**
   * Computes SHA-256 hash of the normalized ICCID string in hex format.
   */
  hashIccid(rawIccid: string): string {
    const normalized = this.normalize(rawIccid);
    return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');
  }

  /**
   * Extracts the last 4 digits of the ICCID.
   */
  getLast4(rawIccid: string): string {
    const normalized = this.normalize(rawIccid);
    return normalized.slice(-4);
  }

  /**
   * Verifies if a detected raw ICCID matches an expected SHA-256 hash.
   */
  verifyIccid(rawIccid: string, expectedHash: string): boolean {
    if (!rawIccid || !expectedHash) return false;
    const computedHash = this.hashIccid(rawIccid);
    return (
      crypto.timingSafeEqual(
        Buffer.from(computedHash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      )
    );
  }
}
