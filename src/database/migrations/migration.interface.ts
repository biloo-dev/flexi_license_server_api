import { FirestoreService } from '../firebase/firestore.service';

export interface Migration {
  id: string;
  version: number;
  description: string;
  up(firestore: FirestoreService): Promise<void>;
  down(firestore: FirestoreService): Promise<void>;
}
