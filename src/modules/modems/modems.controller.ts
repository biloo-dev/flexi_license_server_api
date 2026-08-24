import {
  Controller,
  Get,
  Post,
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
import { ModemsService } from './modems.service';
import { RegisterModemDto, UpdateModemStatusDto } from './dto/register-modem.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constant';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Modems')
@Controller('modems')
export class ModemsController {
  constructor(private readonly modemsService: ModemsService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register or update GSM modem hardware binding' })
  async register(@Body() dto: RegisterModemDto) {
    return this.modemsService.register(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List all modems with optional deviceId filter' })
  @ApiQuery({ name: 'deviceId', required: false })
  async findAll(@Query('deviceId') deviceId?: string) {
    return this.modemsService.findAll(deviceId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get modem by ID' })
  async findById(@Param('id') id: string) {
    return this.modemsService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update modem status (active, blocked, inactive)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateModemStatusDto,
  ) {
    return this.modemsService.updateStatus(id, dto);
  }
}
