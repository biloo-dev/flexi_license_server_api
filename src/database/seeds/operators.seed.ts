import { Seed } from './seed.interface';
import { FirestoreService } from '../firebase/firestore.service';

export class OperatorsSeed implements Seed {
  name = 'operators';

  async run(firestore: FirestoreService): Promise<void> {
    const operators = [
      {
        id: 'djezzy',
        code: 'DJZ',
        name: 'Djezzy',
        status: 'active',
      },
      {
        id: 'mobilis',
        code: 'MOB',
        name: 'Mobilis',
        status: 'active',
      },
      {
        id: 'ooredoo',
        code: 'OOR',
        name: 'Ooredoo',
        status: 'active',
      },
    ];

    for (const op of operators) {
      await firestore.setDoc(
        'operators',
        op.id,
        {
          code: op.code,
          name: op.name,
          status: op.status,
          updatedAt: firestore.serverTimestamp,
        },
        true,
      );
    }
  }
}
