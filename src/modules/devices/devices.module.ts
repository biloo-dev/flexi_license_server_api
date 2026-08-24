import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { AdminDevicesController } from './admin-devices.controller';
import { CustomersModule } from '../customers/customers.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, CustomersModule],
  controllers: [DevicesController, AdminDevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
