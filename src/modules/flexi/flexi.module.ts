import { Module } from '@nestjs/common';
import { FlexiService } from './flexi.service';
import { FlexiController } from './flexi.controller';
import { IdempotencyService } from './idempotency.service';
import { SimAuthModule } from '../sim-auth/sim-auth.module';
import { OperatorsModule } from '../operators/operators.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, SimAuthModule, OperatorsModule],
  controllers: [FlexiController],
  providers: [FlexiService, IdempotencyService],
  exports: [FlexiService, IdempotencyService],
})
export class FlexiModule {}
