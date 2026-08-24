import { FirestoreService } from '../firebase/firestore.service';

export interface Seed {
  name: string;
  run(firestore: FirestoreService): Promise<void>;
}
