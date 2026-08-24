import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ActivationsService } from './activations.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.constant';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Licenses')
@Controller('licenses')
export class ActivationsController {
  constructor(private readonly activationsService: ActivationsService) {}

  @Public()
  @Post('activate')
  @ApiOperation({ summary: 'Activate license serial from Flutter client using detected hardware & SIM' })
  async activate(@Body() dto: ActivateLicenseDto) {
    return this.activationsService.activate(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('activations')
  @ApiOperation({ summary: 'List activation audit records' })
  @ApiQuery({ name: 'deviceId', required: false })
  async findAll(@Query('deviceId') deviceId?: string) {
    return this.activationsService.findAll(deviceId);
  }
}
