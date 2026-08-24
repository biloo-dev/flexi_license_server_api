import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { AuditService } from '../audit/audit.service';
import { CustomersService } from '../customers/customers.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { LicenseEvent } from '../../common/constants/events.constant';
import { RegisterDeviceDto, UpdateDeviceStatusDto } from './dto/register-device.dto';

export interface DeviceDoc {
  id: string;
  customerId: string;
  deviceUuid: string;
  deviceFingerprint: string;
  name: string;
  status: 'pending' | 'active' | 'suspended' | 'blocked' | 'revoked';
  firstSeenAt: any;
  lastSeenAt: any;
  createdAt: any;
  updatedAt: any;
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);
  private readonly collectionName = 'devices';

  constructor(
    private readonly firestore: FirestoreService,
    private readonly auditService: AuditService,
    private readonly customersService: CustomersService,
  ) {}

  async register(dto: RegisterDeviceDto): Promise<DeviceDoc> {
    // 1. Verify customer exists and is active (if customerId provided and not 'unassigned')
    if (dto.customerId && dto.customerId !== 'unassigned') {
      const customer = await this.customersService.findById(dto.customerId);
      if (customer.status !== 'active') {
        throw new BusinessException(
          ErrorCode.CUSTOMER_INACTIVE,
          `Cannot register device for inactive customer '${dto.customerId}' (status: ${customer.status})`,
        );
      }
    }

    // 2. Check if deviceUuid already exists
    const existing = await this.firestore.findOne<DeviceDoc>(this.collectionName, [
      { field: 'deviceUuid', op: '==', value: dto.deviceUuid },
    ]);

    if (existing) {
      // Fingerprint mismatch check
      if (existing.deviceFingerprint !== dto.deviceFingerprint) {
        await this.auditService.logEvent({
          deviceId: existing.id,
          customerId: existing.customerId,
          event: LicenseEvent.DEVICE_MISMATCH,
          metadata: {
            reason: 'Device UUID registered with different hardware fingerprint',
            expectedFingerprint: existing.deviceFingerprint,
            receivedFingerprint: dto.deviceFingerprint,
          },
        });

        throw new BusinessException(
          ErrorCode.DEVICE_MISMATCH,
          'Device UUID is already registered with a different hardware fingerprint. Re-registration rejected.',
        );
      }

      // Update existing device
      await this.firestore.updateDoc(this.collectionName, existing.id, {
        name: dto.name || existing.name,
        lastSeenAt: this.firestore.serverTimestamp,
        updatedAt: this.firestore.serverTimestamp,
      });

      return this.findById(existing.id);
    }

    // 3. Create new device record
    const docData = {
      customerId: dto.customerId,
      deviceUuid: dto.deviceUuid,
      deviceFingerprint: dto.deviceFingerprint,
      name: dto.name || 'Flexi PC',
      status: 'active',
      firstSeenAt: this.firestore.serverTimestamp,
      lastSeenAt: this.firestore.serverTimestamp,
      createdAt: this.firestore.serverTimestamp,
      updatedAt: this.firestore.serverTimestamp,
    };

    const id = await this.firestore.addDoc(this.collectionName, docData);

    await this.auditService.logEvent({
      deviceId: id,
      customerId: dto.customerId,
      event: LicenseEvent.DEVICE_REGISTERED,
      metadata: {
        deviceUuid: dto.deviceUuid,
        name: dto.name,
      },
    });

    return { id, ...docData } as DeviceDoc;
  }

  async findAll(status?: string): Promise<DeviceDoc[]> {
    const filters = status ? [{ field: 'status', op: '==' as const, value: status }] : [];
    return this.firestore.find<DeviceDoc>(this.collectionName, filters);
  }

  async findByCustomerId(customerId: string): Promise<DeviceDoc[]> {
    return this.firestore.find<DeviceDoc>(this.collectionName, [
      { field: 'customerId', op: '==', value: customerId },
    ]);
  }

  async findById(id: string): Promise<DeviceDoc> {
    const doc = await this.firestore.getDoc<DeviceDoc>(this.collectionName, id);
    if (!doc) {
      throw new BusinessException(
        ErrorCode.DEVICE_NOT_FOUND,
        `Device '${id}' not found`,
      );
    }
    return doc;
  }

  async findByUuid(deviceUuid: string): Promise<DeviceDoc | null> {
    return this.firestore.findOne<DeviceDoc>(this.collectionName, [
      { field: 'deviceUuid', op: '==', value: deviceUuid },
    ]);
  }

  async updateStatus(id: string, dto: UpdateDeviceStatusDto): Promise<DeviceDoc> {
    const device = await this.findById(id);
    await this.firestore.updateDoc(this.collectionName, id, {
      status: dto.status,
      updatedAt: this.firestore.serverTimestamp,
    });

    await this.auditService.logEvent({
      deviceId: id,
      customerId: device.customerId,
      event: `DEVICE_STATUS_${dto.status.toUpperCase()}`,
      metadata: { previousStatus: device.status, newStatus: dto.status },
    });

    return this.findById(id);
  }
}
