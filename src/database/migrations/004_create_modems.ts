import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration004CreateModems implements Migration {
  id = '004_create_modems';
  version = 1;
  description = 'Initialize modems collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'modems', {
      collection: 'modems',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: [
        'deviceId',
        'name',
        'port',
        'imei',
        'manufacturer',
        'model',
        'status',
        'lastSeenAt',
        'createdAt',
        'updatedAt',
      ],
      allowedStatuses: ['active', 'blocked', 'inactive'],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'modems');
  }
}
