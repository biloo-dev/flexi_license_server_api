import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { DevicesService } from '../devices/devices.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { RegisterModemDto, UpdateModemStatusDto } from './dto/register-modem.dto';

export interface ModemDoc {
  id: string;
  deviceId: string;
  name: string;
  port: string | null;
  imei: string;
  manufacturer: string;
  model: string;
  status: 'active' | 'blocked' | 'inactive';
  lastSeenAt: any;
  createdAt: any;
  updatedAt: any;
}

@Injectable()
export class ModemsService {
  private readonly logger = new Logger(ModemsService.name);
  private readonly collectionName = 'modems';

  constructor(
    private readonly firestore: FirestoreService,
    private readonly devicesService: DevicesService,
  ) {}

  async register(dto: RegisterModemDto): Promise<ModemDoc> {
    await this.devicesService.findById(dto.deviceId);

    const existing = await this.firestore.findOne<ModemDoc>(this.collectionName, [
      { field: 'imei', op: '==', value: dto.imei.trim() },
    ]);

    if (existing) {
      if (existing.status === 'blocked') {
        throw new BusinessException(
          ErrorCode.MODEM_BLOCKED,
          `Modem with IMEI '${dto.imei}' is blocked by administrator`,
        );
      }

      await this.firestore.updateDoc(this.collectionName, existing.id, {
        deviceId: dto.deviceId,
        port: dto.port || existing.port,
        name: dto.name || existing.name,
        manufacturer: dto.manufacturer || existing.manufacturer,
        model: dto.model || existing.model,
        lastSeenAt: this.firestore.serverTimestamp,
        updatedAt: this.firestore.serverTimestamp,
      });

      return this.findById(existing.id);
    }

    const docData = {
      deviceId: dto.deviceId,
      name: dto.name || `Modem ${dto.imei.slice(-4)}`,
      port: dto.port || null,
      imei: dto.imei.trim(),
      manufacturer: dto.manufacturer || 'QUECTEL',
      model: dto.model || 'EC25',
      status: 'active',
      lastSeenAt: this.firestore.serverTimestamp,
      createdAt: this.firestore.serverTimestamp,
      updatedAt: this.firestore.serverTimestamp,
    };

    const id = await this.firestore.addDoc(this.collectionName, docData);
    return { id, ...docData } as ModemDoc;
  }

  async findAll(deviceId?: string): Promise<ModemDoc[]> {
    const filters = deviceId
      ? [{ field: 'deviceId', op: '==' as const, value: deviceId }]
      : [];
    return this.firestore.find<ModemDoc>(this.collectionName, filters);
  }

  async findById(id: string): Promise<ModemDoc> {
    const doc = await this.firestore.getDoc<ModemDoc>(this.collectionName, id);
    if (!doc) {
      throw new BusinessException(
        ErrorCode.MODEM_NOT_FOUND,
        `Modem '${id}' not found`,
      );
    }
    return doc;
  }

  async findByImei(imei: string): Promise<ModemDoc | null> {
    return this.firestore.findOne<ModemDoc>(this.collectionName, [
      { field: 'imei', op: '==', value: imei.trim() },
    ]);
  }

  async updateStatus(id: string, dto: UpdateModemStatusDto): Promise<ModemDoc> {
    await this.findById(id);
    await this.firestore.updateDoc(this.collectionName, id, {
      status: dto.status,
      updatedAt: this.firestore.serverTimestamp,
    });
    return this.findById(id);
  }
}
