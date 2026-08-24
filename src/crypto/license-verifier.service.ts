import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CanonicalJsonService } from './canonical-json.service';
import { Ed25519Service } from './ed25519.service';
import { IccidService } from './iccid.service';
import {
  LicensePayload,
  LicenseSignatureService,
} from './license-signature.service';
import { FirestoreService } from '../database/firebase/firestore.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { ErrorCode } from '../common/constants/error-codes.constant';

export interface VerifyLicenseContext {
  deviceId?: string;
  deviceUuid?: string;
  customerId?: string;
  detectedIccid?: string;
  detectedIccidHash?: string;
  operatorCode?: string;
  requiredFeature?: string;
  checkDatabase?: boolean;
}

export interface VerificationResult {
  valid: boolean;
  payload: LicensePayload;
  licenseDoc?: any;
  error?: {
    code: string;
    message: string;
  };
}

@Injectable()
export class LicenseVerifierService {
  private readonly logger = new Logger(LicenseVerifierService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly canonicalJson: CanonicalJsonService,
    private readonly ed25519: Ed25519Service,
    private readonly iccidService: IccidService,
    private readonly signatureService: LicenseSignatureService,
    private readonly firestore: FirestoreService,
  ) {}

  /**
   * Resolves the public key for a given keyId.
   * Checks local configuration first, then queries key_versions collection in Firestore.
   */
  async getPublicKeyForKeyId(keyId: string): Promise<string | null> {
    const configuredKeyId = this.configService.get<string>('license.activeKeyId');
    const configuredPubKey = this.configService.get<string>('license.publicKey');

    if (keyId === configuredKeyId && configuredPubKey) {
      return configuredPubKey;
    }

    // Lookup in key_versions collection
    try {
      const doc = await this.firestore.getDoc('key_versions', keyId);
      if (doc && doc.publicKey && doc.status !== 'revoked') {
        return doc.publicKey;
      }
    } catch (err: any) {
      this.logger.warn(`Could not lookup key_versions for ${keyId}: ${err.message}`);
    }

    return null;
  }

  /**
   * 12-point license verification engine.
   */
  async verify(
    serial: string,
    context: VerifyLicenseContext = {},
  ): Promise<VerificationResult> {
    // 1. Format & Parsing
    const parsed = this.signatureService.parseSerial(serial);
    const { payload, signatureBuffer, payloadCanonicalString } = parsed;

    // 2. Schema validation
    if (
      !payload.v ||
      !payload.kid ||
      !payload.licenseId ||
      !payload.simId ||
      !payload.operator ||
      !payload.iccidHash ||
      !payload.deviceId ||
      !payload.exp
    ) {
      throw new BusinessException(
        ErrorCode.LICENSE_INVALID,
        'License payload schema is incomplete or invalid',
      );
    }

    // 3 & 4. KeyId & Public Key Resolution
    const publicKey = await this.getPublicKeyForKeyId(payload.kid);
    if (!publicKey) {
      throw new BusinessException(
        ErrorCode.UNKNOWN_KEY,
        `Unknown or revoked license key ID '${payload.kid}'`,
      );
    }

    // 5. Ed25519 Signature Verification
    const isSignatureValid = this.ed25519.verify(
      payloadCanonicalString,
      signatureBuffer,
      publicKey,
    );

    if (!isSignatureValid) {
      throw new BusinessException(
        ErrorCode.INVALID_SIGNATURE,
        'Digital signature verification failed. License serial may be forged or tampered.',
      );
    }

    // 6. Expiration Check
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSeconds) {
      throw new BusinessException(
        ErrorCode.LICENSE_EXPIRED,
        `License expired on ${new Date(payload.exp * 1000).toISOString()}`,
      );
    }

    // 7. Device Matching
    if (
      context.deviceId &&
      payload.deviceId &&
      payload.deviceId !== '*' &&
      context.deviceId !== payload.deviceId &&
      context.deviceUuid !== payload.deviceId
    ) {
      let isSameCustomerDevice = false;
      if (context.customerId) {
        try {
          const boundDev: any = await this.firestore.getDoc('devices', payload.deviceId);
          if (boundDev && boundDev.customerId === context.customerId) {
            isSameCustomerDevice = true;
          }
        } catch {
          // ignore lookup failure
        }
      }

      if (!isSameCustomerDevice) {
        throw new BusinessException(
          ErrorCode.DEVICE_MISMATCH,
          `Device ID mismatch. License is bound to device '${payload.deviceId}', got '${context.deviceId}'`,
        );
      }
    }

    // 8. Operator Matching
    if (
      context.operatorCode &&
      context.operatorCode.toUpperCase() !== payload.operator.toUpperCase()
    ) {
      throw new BusinessException(
        ErrorCode.OPERATOR_MISMATCH,
        `Operator mismatch. License is for operator '${payload.operator}', detected '${context.operatorCode}'`,
      );
    }

    // 9. ICCID Hash Verification
    if (context.detectedIccid) {
      const isIccidValid = this.iccidService.verifyIccid(
        context.detectedIccid,
        payload.iccidHash,
      );
      if (!isIccidValid) {
        throw new BusinessException(
          ErrorCode.ICCID_MISMATCH,
          'SIM card ICCID does not match the license bound ICCID hash',
        );
      }
    } else if (context.detectedIccidHash) {
      if (
        context.detectedIccidHash.toLowerCase() !==
        payload.iccidHash.toLowerCase()
      ) {
        throw new BusinessException(
          ErrorCode.ICCID_MISMATCH,
          'Detected ICCID hash does not match license ICCID hash',
        );
      }
    }

    // 10. Features Check
    if (
      context.requiredFeature &&
      (!payload.features || !payload.features.includes(context.requiredFeature))
    ) {
      throw new BusinessException(
        ErrorCode.FEATURE_NOT_ALLOWED,
        `License does not permit feature '${context.requiredFeature}'`,
      );
    }

    // 11 & 12. Database Status Check (if requested)
    let licenseDoc: any = null;
    if (context.checkDatabase !== false) {
      try {
        licenseDoc = await this.firestore.getDoc('licenses', payload.licenseId);
        if (!licenseDoc) {
          throw new BusinessException(
            ErrorCode.LICENSE_NOT_FOUND,
            `License '${payload.licenseId}' not found in database records`,
          );
        }

        if (licenseDoc.status === 'revoked') {
          throw new BusinessException(
            ErrorCode.LICENSE_REVOKED,
            `License '${payload.licenseId}' has been revoked by admin`,
          );
        }

        if (licenseDoc.status === 'suspended') {
          throw new BusinessException(
            ErrorCode.LICENSE_SUSPENDED,
            `License '${payload.licenseId}' is temporarily suspended`,
          );
        }

        if (licenseDoc.status !== 'active' && licenseDoc.status !== 'pending') {
          throw new BusinessException(
            ErrorCode.LICENSE_INVALID,
            `License status is '${licenseDoc.status}'`,
          );
        }
      } catch (err: any) {
        if (err instanceof BusinessException) throw err;
        this.logger.warn(`Could not verify license against Firestore: ${err.message}`);
      }
    }

    return {
      valid: true,
      payload,
      licenseDoc,
    };
  }
}
