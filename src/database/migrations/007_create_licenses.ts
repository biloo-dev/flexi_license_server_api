import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration007CreateLicenses implements Migration {
  id = '007_create_licenses';
  version = 1;
  description = 'Initialize licenses collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'licenses', {
      collection: 'licenses',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: [
        'licenseId',
        'simCardId',
        'customerId',
        'deviceId',
        'licenseSerial',
        'keyId',
        'version',
        'issuedAt',
        'expiresAt',
        'status',
        'revokedAt',
        'createdAt',
      ],
      allowedStatuses: ['pending', 'active', 'expired', 'revoked', 'suspended'],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'licenses');
  }
}
