import { Module } from '@nestjs/common';
import { SimAuthorizationService } from './sim-authorization.service';
import { CryptoModule } from '../../crypto/crypto.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, CryptoModule],
  providers: [SimAuthorizationService],
  exports: [SimAuthorizationService],
})
export class SimAuthModule {}
