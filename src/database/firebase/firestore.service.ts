import { Injectable } from '@nestjs/common';
import {
  Firestore,
  FieldValue,
  WhereFilterOp,
  UpdateData,
  DocumentData,
  DocumentReference,
  CollectionReference,
  Query,
  Transaction,
  WriteBatch,
} from 'firebase-admin/firestore';
import { FirebaseService } from './firebase.service';

export type QueryFilter = {
  field: string;
  op: WhereFilterOp;
  value: any;
};

export type QueryOrder = {
  field: string;
  direction?: 'asc' | 'desc';
};

@Injectable()
export class FirestoreService {
  constructor(private readonly firebaseService: FirebaseService) {}

  get db(): Firestore {
    return this.firebaseService.getFirestore();
  }

  get serverTimestamp(): FieldValue {
    return FieldValue.serverTimestamp();
  }

  collection(collectionName: string): CollectionReference {
    return this.db.collection(collectionName);
  }

  doc(collectionName: string, docId: string): DocumentReference {
    return this.db.collection(collectionName).doc(docId);
  }

  async getDoc<T = any>(
    collectionName: string,
    docId: string,
  ): Promise<(T & { id: string }) | null> {
    const snapshot = await this.doc(collectionName, docId).get();
    if (!snapshot.exists) {
      return null;
    }
    return { id: snapshot.id, ...(snapshot.data() as T) };
  }

  async setDoc<T extends Record<string, any>>(
    collectionName: string,
    docId: string,
    data: T,
    merge: boolean = true,
  ): Promise<void> {
    await this.doc(collectionName, docId).set(data, { merge });
  }

  async addDoc<T extends Record<string, any>>(
    collectionName: string,
    data: T,
  ): Promise<string> {
    const docRef = await this.collection(collectionName).add(data);
    return docRef.id;
  }

  async updateDoc(
    collectionName: string,
    docId: string,
    data: UpdateData<DocumentData>,
  ): Promise<void> {
    await this.doc(collectionName, docId).update(data);
  }

  async deleteDoc(collectionName: string, docId: string): Promise<void> {
    await this.doc(collectionName, docId).delete();
  }

  async find<T = any>(
    collectionName: string,
    filters: QueryFilter[] = [],
    orders: QueryOrder[] = [],
    limit?: number,
  ): Promise<(T & { id: string })[]> {
    let query: Query = this.collection(collectionName);

    for (const f of filters) {
      query = query.where(f.field, f.op, f.value);
    }

    for (const o of orders) {
      query = query.orderBy(o.field, o.direction || 'asc');
    }

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
  }

  async findOne<T = any>(
    collectionName: string,
    filters: QueryFilter[] = [],
  ): Promise<(T & { id: string }) | null> {
    const results = await this.find<T>(collectionName, filters, [], 1);
    return results.length > 0 ? results[0] : null;
  }

  async runTransaction<T>(
    updateFunction: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.db.runTransaction(updateFunction);
  }

  batch(): WriteBatch {
    return this.db.batch();
  }
}
