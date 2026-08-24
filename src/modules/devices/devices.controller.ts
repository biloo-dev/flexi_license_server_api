import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a device (UUID + Hardware Fingerprint + Customer ID)' })
  async register(@Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(dto);
  }
}
