import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration002CreateCustomers implements Migration {
  id = '002_create_customers';
  version = 1;
  description = 'Initialize customers collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'customers', {
      collection: 'customers',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: ['name', 'phone', 'email', 'status', 'createdAt', 'updatedAt'],
      allowedStatuses: ['active', 'suspended', 'blocked', 'deleted'],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'customers');
  }
}
