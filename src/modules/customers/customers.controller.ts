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
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerStatusDto,
} from './dto/create-customer.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constant';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Admin - Customers')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer profile' })
  async create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all customers with optional status filter' })
  @ApiQuery({ name: 'status', required: false })
  async findAll(@Query('status') status?: string) {
    return this.customersService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  async findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer details' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCustomerDto>,
  ) {
    return this.customersService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update customer status (active, suspended, blocked, deleted)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    return this.customersService.updateStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete customer and cascade delete associated SIMs and licenses' })
  async delete(@Param('id') id: string) {
    return this.customersService.delete(id);
  }
}
