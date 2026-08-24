import { Injectable } from '@nestjs/common';
import { Base64Url } from '../common/utils/base64url.util';
import { CanonicalJsonService } from './canonical-json.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { ErrorCode } from '../common/constants/error-codes.constant';

export interface LicensePayload {
  v: number;
  kid: string;
  licenseId: string;
  simId: string;
  operator: string;
  iccidHash: string;
  deviceId: string;
  features: string[];
  iat: number;
  exp: number;
}

export interface ParsedLicenseSerial {
  prefix: string;
  payloadEncoded: string;
  signatureEncoded: string;
  payloadCanonicalString: string;
  payload: LicensePayload;
  signatureBuffer: Buffer;
}

@Injectable()
export class LicenseSignatureService {
  public static readonly PREFIX = 'FX1';

  constructor(private readonly canonicalJsonService: CanonicalJsonService) {}

  /**
   * Constructs the full serial string: FX1.<base64url(payload)>.<base64url(sig)>
   */
  buildSerial(payload: LicensePayload, signatureBuffer: Buffer): string {
    const canonicalJson = this.canonicalJsonService.canonicalize(payload);
    const payloadEncoded = Base64Url.encode(canonicalJson);
    const signatureEncoded = Base64Url.encode(signatureBuffer);

    return `${LicenseSignatureService.PREFIX}.${payloadEncoded}.${signatureEncoded}`;
  }

  /**
   * Parses and unpacks a serial string.
   */
  parseSerial(serial: string): ParsedLicenseSerial {
    if (!serial || typeof serial !== 'string') {
      throw new BusinessException(
        ErrorCode.LICENSE_INVALID,
        'License serial string is empty or invalid',
      );
    }

    const parts = serial.trim().split('.');
    if (parts.length !== 3) {
      throw new BusinessException(
        ErrorCode.LICENSE_INVALID,
        `Invalid license serial structure. Expected 3 segments separated by dots, got ${parts.length}`,
      );
    }

    const [prefix, payloadEncoded, signatureEncoded] = parts;
    if (prefix !== LicenseSignatureService.PREFIX) {
      throw new BusinessException(
        ErrorCode.LICENSE_INVALID,
        `Invalid license prefix. Expected '${LicenseSignatureService.PREFIX}', got '${prefix}'`,
      );
    }

    let payloadJsonString: string;
    let payload: LicensePayload;
    try {
      payloadJsonString = Base64Url.decodeToString(payloadEncoded);
      payload = JSON.parse(payloadJsonString);
    } catch {
      throw new BusinessException(
        ErrorCode.LICENSE_INVALID,
        'Failed to decode or parse license payload from serial',
      );
    }

    let signatureBuffer: Buffer;
    try {
      signatureBuffer = Base64Url.decodeToBuffer(signatureEncoded);
    } catch {
      throw new BusinessException(
        ErrorCode.LICENSE_INVALID,
        'Failed to decode license signature buffer',
      );
    }

    // Re-canonicalize the payload object to guarantee byte-for-byte signing verification
    const canonicalString = this.canonicalJsonService.canonicalize(payload);

    return {
      prefix,
      payloadEncoded,
      signatureEncoded,
      payloadCanonicalString: canonicalString,
      payload,
      signatureBuffer,
    };
  }
}
