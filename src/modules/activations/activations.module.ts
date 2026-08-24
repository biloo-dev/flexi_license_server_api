import { Module } from '@nestjs/common';
import { ActivationsService } from './activations.service';
import { ActivationsController } from './activations.controller';
import { SimsModule } from '../sims/sims.module';
import { DevicesModule } from '../devices/devices.module';
import { ModemsModule } from '../modems/modems.module';
import { CryptoModule } from '../../crypto/crypto.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
    SimsModule,
    DevicesModule,
    ModemsModule,
  ],
  controllers: [ActivationsController],
  providers: [ActivationsService],
  exports: [ActivationsService],
})
export class ActivationsModule {}
