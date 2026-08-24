import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { LicenseEvent } from '../../common/constants/events.constant';

export interface LogEventParams {
  licenseId?: string;
  simCardId?: string;
  deviceId?: string;
  customerId?: string;
  event: LicenseEvent | string;
  metadata?: Record<string, any>;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly collectionName = 'license_events';

  constructor(private readonly firestore: FirestoreService) {}

  async logEvent(params: LogEventParams): Promise<string> {
    const sanitizedMetadata = this.sanitize(params.metadata || {});

    const record = {
      licenseId: params.licenseId || null,
      simCardId: params.simCardId || null,
      deviceId: params.deviceId || null,
      customerId: params.customerId || null,
      event: params.event,
      metadata: sanitizedMetadata,
      ip: params.ip || null,
      createdAt: this.firestore.serverTimestamp,
    };

    try {
      const docId = await this.firestore.addDoc(this.collectionName, record);
      this.logger.log(
        `[AUDIT] Event: ${params.event} | Device: ${params.deviceId || 'N/A'} | SIM: ${params.simCardId || 'N/A'} | Doc: ${docId}`,
      );
      return docId;
    } catch (err: any) {
      this.logger.error(`Failed to write audit event: ${err.message}`, err.stack);
      return '';
    }
  }

  private sanitize(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('privatekey') ||
        lowerKey.includes('token')
      ) {
        sanitized[key] = '***REDACTED***';
      } else if (lowerKey === 'iccid' && typeof value === 'string') {
        sanitized['iccidLast4'] = value.slice(-4);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
