import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SimsModule } from '../sims/sims.module';
import { DevicesModule } from '../devices/devices.module';
import { CustomersModule } from '../customers/customers.module';
import { OperatorsModule } from '../operators/operators.module';
import { CryptoModule } from '../../crypto/crypto.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
    SimsModule,
    DevicesModule,
    CustomersModule,
    OperatorsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
