import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration005CreateSimCards implements Migration {
  id = '005_create_sim_cards';
  version = 1;
  description = 'Initialize sim_cards collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'sim_cards', {
      collection: 'sim_cards',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: [
        'customerId',
        'operatorId',
        'iccidHash',
        'iccidLast4',
        'phoneNumber',
        'status',
        'requiredForAccess',
        'activatedAt',
        'blockedAt',
        'createdAt',
        'updatedAt',
      ],
      allowedStatuses: [
        'pending',
        'active',
        'blocked',
        'suspended',
        'expired',
        'revoked',
      ],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'sim_cards');
  }
}
