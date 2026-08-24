import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration010CreateFlexiOperations implements Migration {
  id = '010_create_flexi_operations';
  version = 1;
  description = 'Initialize flexi_operations collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'flexi_operations', {
      collection: 'flexi_operations',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: [
        'customerId',
        'deviceId',
        'simCardId',
        'operatorId',
        'phoneNumber',
        'operationType',
        'amount',
        'status',
        'failureReason',
        'idempotencyKey',
        'createdAt',
        'completedAt',
      ],
      allowedStatuses: [
        'pending',
        'processing',
        'success',
        'failed',
        'blocked',
        'cancelled',
      ],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'flexi_operations');
  }
}
