import { Module } from '@nestjs/common';
import { ModemsService } from './modems.service';
import { ModemsController } from './modems.controller';
import { DevicesModule } from '../devices/devices.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, DevicesModule],
  controllers: [ModemsController],
  providers: [ModemsService],
  exports: [ModemsService],
})
export class ModemsModule {}
