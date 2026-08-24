import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { SimsService } from './sims.service';
import {
  CreateSimDto,
  BindSimDto,
  UpdateSimStatusDto,
  TransferSimOwnerDto,
  UpdateSimDto,
} from './dto/create-sim.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constant';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Admin - SIM Cards')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/sims')
export class SimsController {
  constructor(private readonly simsService: SimsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new SIM card (hashes raw ICCID with SHA256)' })
  async create(@Body() dto: CreateSimDto) {
    return this.simsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all SIM cards with customer and status filters' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.simsService.findAll(customerId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get SIM card details by ID' })
  async findById(@Param('id') id: string) {
    return this.simsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update SIM card phone, operator, ICCID or status' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSimDto,
  ) {
    return this.simsService.update(id, dto);
  }

  @Post(':id/bind-modem')
  @ApiOperation({ summary: 'Bind SIM card to a GSM modem and slot' })
  async bindModem(@Param('id') id: string, @Body() dto: BindSimDto) {
    return this.simsService.bindToModem(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update SIM status (active, blocked, suspended, expired, revoked)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSimStatusDto,
  ) {
    return this.simsService.updateStatus(id, dto);
  }

  @Post(':id/transfer-owner')
  @ApiOperation({ summary: 'Transfer SIM card ownership to a new customer' })
  async transferOwner(
    @Param('id') id: string,
    @Body() dto: TransferSimOwnerDto,
  ) {
    return this.simsService.transferOwnership(id, dto.newCustomerId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete SIM card and associated bindings and licenses' })
  async delete(@Param('id') id: string) {
    return this.simsService.delete(id);
  }
}
