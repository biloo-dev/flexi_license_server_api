import {
  Controller,
  Get,
  Post,
  Delete,
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
import { LicensesService } from './licenses.service';
import { CreateLicenseDto, RenewLicenseDto } from './dto/create-license.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constant';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Admin - Licenses')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Post()
  @ApiOperation({ summary: 'Issue a new license and Ed25519 digital signature serial' })
  async create(@Body() dto: CreateLicenseDto) {
    return this.licensesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all licenses with optional customer/SIM/status filters' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'simCardId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @Query('customerId') customerId?: string,
    @Query('simCardId') simCardId?: string,
    @Query('status') status?: string,
  ) {
    return this.licensesService.findAll({ customerId, simCardId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get license details by ID' })
  async findById(@Param('id') id: string) {
    return this.licensesService.findById(id);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke a license immediately' })
  async revoke(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.licensesService.revoke(id, reason);
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renew a license (re-signs with active Ed25519 key)' })
  async renew(@Param('id') id: string, @Body() dto: RenewLicenseDto) {
    return this.licensesService.renew(id, dto);
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend a license temporarily' })
  async suspend(@Param('id') id: string) {
    return this.licensesService.suspend(id);
  }

  @Post(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended license' })
  async reactivate(@Param('id') id: string) {
    return this.licensesService.reactivate(id);
  }

  @Post(':id/regenerate-serial')
  @ApiOperation({ summary: 'Regenerate a new cryptographic Ed25519 serial for an existing license' })
  async regenerateSerial(
    @Param('id') id: string,
    @Body('validityDays') validityDays?: number,
  ) {
    return this.licensesService.regenerateSerial(id, validityDays);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a license permanently' })
  async delete(@Param('id') id: string) {
    return this.licensesService.delete(id);
  }
}
