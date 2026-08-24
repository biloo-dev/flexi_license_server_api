import { Migration } from './migration.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class Migration012CreateKeyVersions implements Migration {
  id = '012_create_key_versions';
  version = 1;
  description = 'Initialize key_versions collection schema for Ed25519 public metadata';

  async up(firestore: FirestoreService): Promise<void> {
    await firestore.setDoc('_schema', 'key_versions', {
      collection: 'key_versions',
      version: 1,
      initializedAt: firestore.serverTimestamp,
      fields: ['keyId', 'algorithm', 'status', 'publicKey', 'createdAt', 'retiredAt'],
      allowedStatuses: ['active', 'retired', 'revoked'],
    });
  }

  async down(firestore: FirestoreService): Promise<void> {
    await firestore.deleteDoc('_schema', 'key_versions');
  }
}
