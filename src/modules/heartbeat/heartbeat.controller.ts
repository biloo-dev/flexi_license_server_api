import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HeartbeatService } from './heartbeat.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Devices')
@Controller('devices')
export class HeartbeatController {
  constructor(private readonly heartbeatService: HeartbeatService) {}

  @Public()
  @Post('heartbeat')
  @ApiOperation({
    summary:
      'Device status heartbeat: updates last seen, checks modem & SIM statuses, returns 48h signed offline token',
  })
  async heartbeat(@Body() dto: HeartbeatDto) {
    return this.heartbeatService.processHeartbeat(dto);
  }
}
