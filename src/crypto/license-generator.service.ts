import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CanonicalJsonService } from './canonical-json.service';
import { Ed25519Service } from './ed25519.service';
import { IccidService } from './iccid.service';
import {
  LicensePayload,
  LicenseSignatureService,
} from './license-signature.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { ErrorCode } from '../common/constants/error-codes.constant';

export interface GenerateLicenseParams {
  licenseId: string;
  simId: string;
  operator: string;
  rawIccid?: string;
  iccidHash?: string;
  deviceId: string;
  features?: string[];
  validityDays?: number;
  keyId?: string;
  privateKeyPem?: string;
}

export interface GeneratedLicenseResult {
  serial: string;
  payload: LicensePayload;
  licenseId: string;
  issuedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class LicenseGeneratorService {
  private readonly logger = new Logger(LicenseGeneratorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly canonicalJson: CanonicalJsonService,
    private readonly ed25519: Ed25519Service,
    private readonly iccidService: IccidService,
    private readonly signatureService: LicenseSignatureService,
  ) {}

  async generateLicense(
    params: GenerateLicenseParams,
  ): Promise<GeneratedLicenseResult> {
    const keyId =
      params.keyId ||
      this.configService.get<string>('license.activeKeyId') ||
      '2026-01';

    const privateKey =
      params.privateKeyPem ||
      this.configService.get<string>('license.privateKey');

    if (!privateKey) {
      throw new BusinessException(
        ErrorCode.INTERNAL_ERROR,
        `No Ed25519 private key configured on server for keyId '${keyId}'. Set LICENSE_PRIVATE_KEY in .env.`,
      );
    }

    let iccidHash = params.iccidHash;
    if (!iccidHash) {
      if (!params.rawIccid) {
        throw new BusinessException(
          ErrorCode.VALIDATION_ERROR,
          'Either rawIccid or iccidHash must be provided to generate a license',
        );
      }
      iccidHash = this.iccidService.hashIccid(params.rawIccid);
    }

    const validityDays =
      params.validityDays ||
      this.configService.get<number>('license.defaultValidityDays') ||
      365;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expSeconds = nowSeconds + validityDays * 24 * 60 * 60;

    const payload: LicensePayload = {
      v: 1,
      kid: keyId,
      licenseId: params.licenseId,
      simId: params.simId,
      operator: params.operator.toUpperCase(),
      iccidHash,
      deviceId: params.deviceId,
      features: params.features || ['FLEXI'],
      iat: nowSeconds,
      exp: expSeconds,
    };

    // Canonical JSON string
    const canonicalString = this.canonicalJson.canonicalize(payload);

    // Sign canonical string
    let signatureBuffer: Buffer;
    try {
      signatureBuffer = this.ed25519.sign(canonicalString, privateKey);
    } catch (err: any) {
      this.logger.error(`Error signing license: ${err.message}`, err.stack);
      throw new BusinessException(
        ErrorCode.INTERNAL_ERROR,
        `Failed to sign license with keyId '${keyId}': ${err.message}`,
      );
    }

    // Build serial FX1.<base64url(payload)>.<base64url(sig)>
    const serial = this.signatureService.buildSerial(payload, signatureBuffer);

    return {
      serial,
      payload,
      licenseId: params.licenseId,
      issuedAt: new Date(nowSeconds * 1000),
      expiresAt: new Date(expSeconds * 1000),
    };
  }
}
