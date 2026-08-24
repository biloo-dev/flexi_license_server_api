import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration006CreateSimBindings implements Migration {
  id = '006_create_sim_bindings';
  version = 1;
  description = 'Initialize sim_bindings collection schema';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'sim_bindings', {
      collection: 'sim_bindings',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: [
        'simCardId',
        'modemId',
        'slot',
        'status',
        'assignedAt',
        'removedAt',
      ],
      allowedStatuses: ['active', 'unbound'],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'sim_bindings');
  }
}
