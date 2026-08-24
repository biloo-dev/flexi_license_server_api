import { Module } from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { LicensesController } from './licenses.controller';
import { SimsModule } from '../sims/sims.module';
import { DevicesModule } from '../devices/devices.module';
import { OperatorsModule } from '../operators/operators.module';
import { CryptoModule } from '../../crypto/crypto.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
    SimsModule,
    DevicesModule,
    OperatorsModule,
  ],
  controllers: [LicensesController],
  providers: [LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
