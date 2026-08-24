import { Module } from '@nestjs/common';
import { SimsService } from './sims.service';
import { SimsController } from './sims.controller';
import { CustomersModule } from '../customers/customers.module';
import { OperatorsModule } from '../operators/operators.module';
import { ModemsModule } from '../modems/modems.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    CustomersModule,
    OperatorsModule,
    ModemsModule,
  ],
  controllers: [SimsController],
  providers: [SimsService],
  exports: [SimsService],
})
export class SimsModule {}
