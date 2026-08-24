import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { Seed } from './seed.interface';
import { OperatorsSeed } from './operators.seed';

@Injectable()
export class SeedRunner {
  private readonly logger = new Logger(SeedRunner.name);
  private readonly seeds: Seed[] = [new OperatorsSeed()];

  constructor(private readonly firestore: FirestoreService) {}

  async run(): Promise<{ seeded: string[] }> {
    this.logger.log('Starting Firestore database seeding...');
    const seeded: string[] = [];

    for (const seed of this.seeds) {
      this.logger.log(`[SEED] Executing seed: ${seed.name}`);
      try {
        await seed.run(this.firestore);
        seeded.push(seed.name);
        this.logger.log(`[SEED DONE] Completed: ${seed.name}`);
      } catch (err: any) {
        this.logger.error(`[SEED FAILED] Error on ${seed.name}: ${err.message}`, err.stack);
        throw err;
      }
    }

    this.logger.log(`Seeding finished: ${seeded.length} seeds applied.`);
    return { seeded };
  }
}
