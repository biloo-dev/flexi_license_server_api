import { Global, Module } from '@nestjs/common';
import { CanonicalJsonService } from './canonical-json.service';
import { IccidService } from './iccid.service';
import { Ed25519Service } from './ed25519.service';
import { LicenseSignatureService } from './license-signature.service';
import { LicenseGeneratorService } from './license-generator.service';
import { LicenseVerifierService } from './license-verifier.service';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    CanonicalJsonService,
    IccidService,
    Ed25519Service,
    LicenseSignatureService,
    LicenseGeneratorService,
    LicenseVerifierService,
  ],
  exports: [
    CanonicalJsonService,
    IccidService,
    Ed25519Service,
    LicenseSignatureService,
    LicenseGeneratorService,
    LicenseVerifierService,
  ],
})
export class CryptoModule {}
