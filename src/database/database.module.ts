import { Module } from '@nestjs/common';
import { FirebaseModule } from './firebase/firebase.module';
import { MigrationRunner } from './migrations/migration.runner';
import { SeedRunner } from './seeds/seed.runner';

@Module({
  imports: [FirebaseModule],
  providers: [MigrationRunner, SeedRunner],
  exports: [FirebaseModule, MigrationRunner, SeedRunner],
})
export class DatabaseModule {}
