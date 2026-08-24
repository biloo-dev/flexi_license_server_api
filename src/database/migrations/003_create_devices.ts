import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration003CreateDevices implements Migration {
  id = '003_create_devices';
  version = 1;
  description = 'Initialize devices collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'devices', {
      collection: 'devices',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: [
        'customerId',
        'deviceUuid',
        'deviceFingerprint',
        'name',
        'status',
        'firstSeenAt',
        'lastSeenAt',
        'createdAt',
        'updatedAt',
      ],
      allowedStatuses: ['pending', 'active', 'suspended', 'blocked', 'revoked'],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'devices');
  }
}
