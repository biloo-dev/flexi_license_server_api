import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration008CreateLicensePayments implements Migration {
  id = '008_create_license_payments';
  version = 1;
  description = 'Initialize license_payments collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'license_payments', {
      collection: 'license_payments',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: [
        'licenseId',
        'customerId',
        'amount',
        'currency',
        'reference',
        'status',
        'paidAt',
        'createdAt',
      ],
      allowedStatuses: ['pending', 'paid', 'failed', 'cancelled', 'refunded'],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'license_payments');
  }
}
