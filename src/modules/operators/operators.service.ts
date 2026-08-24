import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';

export interface OperatorDoc {
  id: string;
  code: string;
  name: string;
  status: string;
}

@Injectable()
export class OperatorsService {
  constructor(private readonly firestore: FirestoreService) {}

  async findAll(): Promise<OperatorDoc[]> {
    return this.firestore.find<OperatorDoc>('operators', [
      { field: 'status', op: '==', value: 'active' },
    ]);
  }

  async findById(id: string): Promise<OperatorDoc> {
    const doc = await this.firestore.getDoc<OperatorDoc>('operators', id.toLowerCase());
    if (!doc) {
      throw new BusinessException(
        ErrorCode.OPERATOR_NOT_FOUND,
        `Operator '${id}' not found`,
      );
    }
    return doc;
  }

  async findByCode(code: string): Promise<OperatorDoc> {
    const doc = await this.firestore.findOne<OperatorDoc>('operators', [
      { field: 'code', op: '==', value: code.toUpperCase() },
    ]);
    if (!doc) {
      throw new BusinessException(
        ErrorCode.OPERATOR_NOT_FOUND,
        `Operator with code '${code}' not found`,
      );
    }
    return doc;
  }
}
