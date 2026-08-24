import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FirestoreService, QueryFilter } from '../../database/firebase/firestore.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constant';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Admin - Audit Logs')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly firestore: FirestoreService) {}

  @Get('events')
  @ApiOperation({ summary: 'Query audit logs and license events' })
  @ApiQuery({ name: 'deviceId', required: false })
  @ApiQuery({ name: 'licenseId', required: false })
  @ApiQuery({ name: 'simCardId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'event', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getEvents(
    @Query('deviceId') deviceId?: string,
    @Query('licenseId') licenseId?: string,
    @Query('simCardId') simCardId?: string,
    @Query('customerId') customerId?: string,
    @Query('event') event?: string,
    @Query('limit') limit?: number,
  ) {
    const filters: QueryFilter[] = [];
    if (deviceId) filters.push({ field: 'deviceId', op: '==' as const, value: deviceId });
    if (licenseId) filters.push({ field: 'licenseId', op: '==' as const, value: licenseId });
    if (simCardId) filters.push({ field: 'simCardId', op: '==' as const, value: simCardId });
    if (customerId) filters.push({ field: 'customerId', op: '==' as const, value: customerId });
    if (event) filters.push({ field: 'event', op: '==' as const, value: event });

    return this.firestore.find('license_events', filters, [{ field: 'createdAt', direction: 'desc' }], limit || 50);
  }
}
