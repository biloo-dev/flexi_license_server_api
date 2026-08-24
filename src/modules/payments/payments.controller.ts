import {
  Controller,
  Get,
  Post,
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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constant';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Admin - Payments')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a pending license payment' })
  async create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm payment (atomically generates, Ed25519-signs license, activates SIM, and returns serial)' })
  async confirmPayment(@Param('id') id: string) {
    return this.paymentsService.confirmPayment(id);
  }

  @Get()
  @ApiOperation({ summary: 'List all payments with optional customer and status filters' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.paymentsService.findAll(customerId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment record by ID' })
  async findById(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }
}
