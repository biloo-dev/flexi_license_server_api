import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FlexiService } from './flexi.service';
import { CreateFlexiOperationDto } from './dto/create-operation.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constant';

@ApiTags('Flexi Operations')
@Controller('flexi')
export class FlexiController {
  constructor(private readonly flexiService: FlexiService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.DEVICE, UserRole.ADMIN, UserRole.CUSTOMER)
  @Post('operations')
  @ApiOperation({
    summary:
      'Execute Flexi recharge operation (strictly requires valid SIM authorization & Idempotency)',
  })
  async executeOperation(@Body() dto: CreateFlexiOperationDto) {
    return this.flexiService.executeOperation(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('operations')
  @ApiOperation({ summary: 'List all Flexi operations history' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'deviceId', required: false })
  @ApiQuery({ name: 'simCardId', required: false })
  async findAll(
    @Query('customerId') customerId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('simCardId') simCardId?: string,
  ) {
    return this.flexiService.findAll({ customerId, deviceId, simCardId });
  }
}
