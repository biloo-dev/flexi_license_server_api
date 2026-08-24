import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration011CreateLicenseEvents implements Migration {
  id = '011_create_license_events';
  version = 1;
  description = 'Initialize license_events collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'license_events', {
      collection: 'license_events',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: [
        'licenseId',
        'simCardId',
        'deviceId',
        'event',
        'metadata',
        'createdAt',
      ],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'license_events');
  }
}
