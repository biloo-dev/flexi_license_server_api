import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorCode } from '../constants/error-codes.constant';

@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private readonly firestore: FirestoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body || {};

    const deviceId = user?.deviceId || body.deviceId;
    if (!deviceId) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Device ID is required for this operation',
      );
    }

    const device = await this.firestore.getDoc('devices', deviceId);
    if (!device) {
      throw new BusinessException(
        ErrorCode.DEVICE_NOT_FOUND,
        `Device '${deviceId}' is not registered`,
      );
    }

    if (device.status !== 'active') {
      throw new BusinessException(
        ErrorCode.DEVICE_BLOCKED,
        `Device status is '${device.status}'. Only active devices are permitted.`,
      );
    }

    request.device = device;
    return true;
  }
}
