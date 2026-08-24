import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration009CreateLicenseActivations implements Migration {
  id = '009_create_license_activations';
  version = 1;
  description = 'Initialize license_activations collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'license_activations', {
      collection: 'license_activations',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: [
        'licenseId',
        'simCardId',
        'deviceId',
        'modemId',
        'detectedIccidHash',
        'appVersion',
        'status',
        'activatedAt',
        'createdAt',
      ],
      allowedStatuses: ['success', 'failed'],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'license_activations');
  }
}
