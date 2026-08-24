import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration001CreateOperators implements Migration {
  id = '001_create_operators';
  version = 1;
  description = 'Initialize operators collection schema and verify read/write access';

  async up(firestore: FirestoreService): Promise<void> {
    // We create a metadata placeholder doc to initialize and test the collection
    await firestore.setDoc('_schema', 'operators', {
      collection: 'operators',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: ['code', 'name', 'status'],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'operators');
  }
}
