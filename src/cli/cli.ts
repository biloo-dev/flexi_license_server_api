import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MigrationRunner } from '../database/migrations/migration.runner';
import { SeedRunner } from '../database/seeds/seed.runner';
import { Ed25519Service } from '../crypto/ed25519.service';
import { LicenseGeneratorService } from '../crypto/license-generator.service';

async function bootstrap() {
  const args = process.argv.slice(2);
  const command = args[0];

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    switch (command) {
      case 'migration:run': {
        const runner = app.get(MigrationRunner);
        const result = await runner.run();
        console.log('\nMigration Run Result:', JSON.stringify(result, null, 2));
        break;
      }
      case 'migration:status': {
        const runner = app.get(MigrationRunner);
        const status = await runner.status();
        console.table(status);
        break;
      }
      case 'migration:rollback': {
        const steps = parseInt(args[1] || '1', 10);
        const runner = app.get(MigrationRunner);
        const result = await runner.rollback(steps);
        console.log('\nRollback Result:', JSON.stringify(result, null, 2));
        break;
      }
      case 'seed': {
        const runner = app.get(SeedRunner);
        const result = await runner.run();
        console.log('\nSeed Result:', JSON.stringify(result, null, 2));
        break;
      }
      case 'license:generate-key': {
        const ed25519 = app.get(Ed25519Service);
        const keyPair = ed25519.generateKeyPair();
        console.log('\n=== Ed25519 Key Pair Generated ===');
        console.log('Key ID:', args[1] || '2026-01');
        console.log('\n--- PUBLIC KEY (Share with Flutter client / Store in DB) ---');
        console.log(keyPair.publicKey);
        console.log('\n--- PRIVATE KEY (Keep secret in .env or Secret Manager) ---');
        console.log(keyPair.privateKey);
        console.log('====================================\n');
        break;
      }
      case 'license:generate': {
        const generator = app.get(LicenseGeneratorService);
        const licenseId = args[1] || 'lic-' + Date.now();
        const simId = args[2] || 'sim-sample-01';
        const operator = args[3] || 'DJZ';
        const iccid = args[4] || '89213012345678901234';
        const deviceId = args[5] || 'dev-pc-01';

        console.log('\nGenerating license for:', {
          licenseId,
          simId,
          operator,
          iccid,
          deviceId,
        });

        const result = await generator.generateLicense({
          licenseId,
          simId,
          operator,
          rawIccid: iccid,
          deviceId,
          validityDays: 365,
        });

        console.log('\n=== License Generated Successfully ===');
        console.log('Serial:', result.serial);
        console.log('Key ID:', result.payload.kid);
        console.log('Expires At:', result.expiresAt);
        console.log('ICCID Hash:', result.payload.iccidHash);
        console.log('=======================================\n');
        break;
      }
      default: {
        console.log(`
Usage: ts-node src/cli/cli.ts <command> [options]

Commands:
  migration:run           Execute all pending Firestore migrations
  migration:status        Check migration status
  migration:rollback [N]  Rollback last N migrations (default 1)
  seed                    Execute database seeds
  license:generate-key [kid] Generate a new Ed25519 key pair
  license:generate [licId] [simId] [operator] [iccid] [deviceId] Generate and sign a license serial
        `);
      }
    }
  } catch (err: any) {
    console.error('CLI execution error:', err.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
