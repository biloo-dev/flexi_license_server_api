import { Module } from '@nestjs/common';
import { HeartbeatService } from './heartbeat.service';
import { HeartbeatController } from './heartbeat.controller';
import { DevicesModule } from '../devices/devices.module';
import { ModemsModule } from '../modems/modems.module';
import { SimsModule } from '../sims/sims.module';
import { LicensesModule } from '../licenses/licenses.module';
import { SimAuthModule } from '../sim-auth/sim-auth.module';
import { CryptoModule } from '../../crypto/crypto.module';
import { DatabaseModule } from '../../database/database.module';

import { HeartbeatGateway } from './heartbeat.gateway';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
    DevicesModule,
    ModemsModule,
    SimsModule,
    LicensesModule,
    SimAuthModule,
  ],
  controllers: [HeartbeatController],
  providers: [HeartbeatService, HeartbeatGateway],
  exports: [HeartbeatService, HeartbeatGateway],
})
export class HeartbeatModule {}
