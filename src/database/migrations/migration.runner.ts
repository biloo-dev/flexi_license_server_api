import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { Migration } from './migration.interface';
import { Migration001CreateOperators } from './001_create_operators';
import { Migration002CreateCustomers } from './002_create_customers';
import { Migration003CreateDevices } from './003_create_devices';
import { Migration004CreateModems } from './004_create_modems';
import { Migration005CreateSimCards } from './005_create_sim_cards';
import { Migration006CreateSimBindings } from './006_create_sim_bindings';
import { Migration007CreateLicenses } from './007_create_licenses';
import { Migration008CreateLicensePayments } from './008_create_license_payments';
import { Migration009CreateLicenseActivations } from './009_create_license_activations';
import { Migration010CreateFlexiOperations } from './010_create_flexi_operations';
import { Migration011CreateLicenseEvents } from './011_create_license_events';
import { Migration012CreateKeyVersions } from './012_create_key_versions';

@Injectable()
export class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);
  private readonly collectionName = '_system_migrations';

  private readonly migrations: Migration[] = [
    new Migration001CreateOperators(),
    new Migration002CreateCustomers(),
    new Migration003CreateDevices(),
    new Migration004CreateModems(),
    new Migration005CreateSimCards(),
    new Migration006CreateSimBindings(),
    new Migration007CreateLicenses(),
    new Migration008CreateLicensePayments(),
    new Migration009CreateLicenseActivations(),
    new Migration010CreateFlexiOperations(),
    new Migration011CreateLicenseEvents(),
    new Migration012CreateKeyVersions(),
  ];

  constructor(private readonly firestore: FirestoreService) {}

  async run(): Promise<{ executed: string[]; skipped: string[] }> {
    this.logger.log('Starting Firestore migrations...');
    const executed: string[] = [];
    const skipped: string[] = [];

    for (const migration of this.migrations) {
      const existing = await this.firestore.getDoc(
        this.collectionName,
        migration.id,
      );

      if (existing) {
        this.logger.log(`[SKIP] Migration already applied: ${migration.id}`);
        skipped.push(migration.id);
        continue;
      }

      this.logger.log(`[EXECUTE] Running migration: ${migration.id} - ${migration.description}`);
      try {
        await migration.up(this.firestore);
        await this.firestore.setDoc(this.collectionName, migration.id, {
          name: migration.id,
          version: migration.version,
          description: migration.description,
          executedAt: this.firestore.serverTimestamp,
        });
        this.logger.log(`[DONE] Migration finished: ${migration.id}`);
        executed.push(migration.id);
      } catch (err: any) {
        this.logger.error(
          `[FAILED] Migration error on ${migration.id}: ${err.message}`,
          err.stack,
        );
        throw err;
      }
    }

    this.logger.log(
      `Migrations summary: ${executed.length} executed, ${skipped.length} skipped.`,
    );
    return { executed, skipped };
  }

  async status(): Promise<
    Array<{ id: string; version: number; description: string; status: string; executedAt?: any }>
  > {
    const results: Array<{ id: string; version: number; description: string; status: string; executedAt?: any }> = [];
    for (const migration of this.migrations) {
      const doc = await this.firestore.getDoc(
        this.collectionName,
        migration.id,
      );
      results.push({
        id: migration.id,
        version: migration.version,
        description: migration.description,
        status: doc ? 'APPLIED' : 'PENDING',
        executedAt: doc ? doc.executedAt : null,
      });
    }
    return results;
  }

  async rollback(steps: number = 1): Promise<{ rolledBack: string[] }> {
    this.logger.warn(`Starting migration rollback for last ${steps} step(s)...`);
    const rolledBack: string[] = [];

    // Find applied migrations in reverse order
    const reverseList = [...this.migrations].reverse();

    let count = 0;
    for (const migration of reverseList) {
      if (count >= steps) break;

      const doc = await this.firestore.getDoc(
        this.collectionName,
        migration.id,
      );

      if (doc) {
        this.logger.log(`[ROLLBACK] Reverting migration: ${migration.id}`);
        try {
          await migration.down(this.firestore);
          await this.firestore.deleteDoc(this.collectionName, migration.id);
          rolledBack.push(migration.id);
          count++;
          this.logger.log(`[REVERTED] Migration: ${migration.id}`);
        } catch (err: any) {
          this.logger.error(
            `[ROLLBACK FAILED] Error reverting ${migration.id}: ${err.message}`,
            err.stack,
          );
          throw err;
        }
      }
    }

    this.logger.log(`Rollback completed: ${rolledBack.length} reverted.`);
    return { rolledBack };
  }
}
