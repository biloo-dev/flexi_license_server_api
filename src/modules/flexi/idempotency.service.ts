import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';

export interface OperationDoc {
  id: string;
  customerId: string;
  deviceId: string;
  simCardId: string;
  operatorId: string;
  phoneNumber: string;
  operationType: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'blocked' | 'cancelled';
  failureReason: string | null;
  idempotencyKey: string;
  createdAt: any;
  completedAt: any;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly collectionName = 'flexi_operations';

  constructor(private readonly firestore: FirestoreService) {}

  async findExistingOperation(idempotencyKey: string): Promise<OperationDoc | null> {
    return this.firestore.findOne<OperationDoc>(this.collectionName, [
      { field: 'idempotencyKey', op: '==', value: idempotencyKey.trim() },
    ]);
  }
}
