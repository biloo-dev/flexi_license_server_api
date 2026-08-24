import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { FirebaseService } from '../../database/firebase/firebase.service';
import { UserRole } from '../../common/constants/roles.constant';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { AdminLoginDto, DeviceAuthDto } from './dto/login.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly firestore: FirestoreService,
    private readonly firebase: FirebaseService,
  ) {}

  async loginAdmin(dto: AdminLoginDto): Promise<{ accessToken: string; role: string; expiresIn: string }> {
    // Check if configured default admin or database admin
    const defaultAdminEmail = process.env.ADMIN_EMAIL || 'admin@flexi.dz';
    const defaultAdminPass = process.env.ADMIN_PASSWORD || 'AdminFlexi2026!';

    let adminId = 'admin-root';
    let isValid = false;

    if (dto.email === defaultAdminEmail && dto.password === defaultAdminPass) {
      isValid = true;
    } else {
      // Query admins collection in firestore
      const adminDoc = await this.firestore.findOne('admins', [
        { field: 'email', op: '==', value: dto.email.toLowerCase() },
      ]);

      if (adminDoc && adminDoc.passwordHash) {
        const hash = crypto.createHash('sha256').update(dto.password).digest('hex');
        if (hash === adminDoc.passwordHash && adminDoc.status === 'active') {
          isValid = true;
          adminId = adminDoc.id;
        }
      }
    }

    if (!isValid) {
      throw new BusinessException(
        ErrorCode.AUTH_INVALID,
        'Invalid admin email or password',
      );
    }

    const payload = {
      sub: adminId,
      email: dto.email,
      role: UserRole.ADMIN,
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.configService.get<string>('security.jwtExpiresIn') || '7d';

    return {
      accessToken,
      role: UserRole.ADMIN,
      expiresIn,
    };
  }

  async authenticateDevice(dto: DeviceAuthDto): Promise<{ accessToken: string; role: string; deviceId: string; customerId: string }> {
    // Find device in devices collection
    const device = await this.firestore.findOne('devices', [
      { field: 'deviceUuid', op: '==', value: dto.deviceUuid },
    ]);

    if (!device) {
      throw new BusinessException(
        ErrorCode.DEVICE_NOT_FOUND,
        `Device with UUID '${dto.deviceUuid}' is not registered. Please register the device first.`,
      );
    }

    if (device.deviceFingerprint !== dto.deviceFingerprint) {
      throw new BusinessException(
        ErrorCode.DEVICE_MISMATCH,
        'Device hardware fingerprint does not match server registration records',
      );
    }

    if (device.status === 'blocked' || device.status === 'revoked') {
      throw new BusinessException(
        ErrorCode.DEVICE_BLOCKED,
        `Device is ${device.status}. Access denied.`,
      );
    }

    if (device.status === 'pending') {
      throw new BusinessException(
        ErrorCode.DEVICE_PENDING,
        'Device registration is pending approval by admin.',
      );
    }

    // Update lastSeenAt
    await this.firestore.updateDoc('devices', device.id, {
      lastSeenAt: this.firestore.serverTimestamp,
    });

    const payload = {
      sub: device.id,
      deviceId: device.id,
      deviceUuid: device.deviceUuid,
      customerId: device.customerId,
      role: UserRole.DEVICE,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      role: UserRole.DEVICE,
      deviceId: device.id,
      customerId: device.customerId,
    };
  }

  async verifyFirebaseToken(idToken: string): Promise<any> {
    try {
      const decoded = await this.firebase.getAuth().verifyIdToken(idToken);
      return decoded;
    } catch (err: any) {
      throw new BusinessException(
        ErrorCode.AUTH_INVALID,
        `Firebase token verification failed: ${err.message}`,
      );
    }
  }
}
