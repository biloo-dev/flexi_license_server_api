import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { UpdateDeviceStatusDto } from './dto/register-device.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constant';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Admin - Devices')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/devices')
export class AdminDevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered devices' })
  @ApiQuery({ name: 'status', required: false })
  async findAll(@Query('status') status?: string) {
    return this.devicesService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device details by ID' })
  async findById(@Param('id') id: string) {
    return this.devicesService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update device status (pending, active, suspended, blocked, revoked)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeviceStatusDto,
  ) {
    return this.devicesService.updateStatus(id, dto);
  }
}
