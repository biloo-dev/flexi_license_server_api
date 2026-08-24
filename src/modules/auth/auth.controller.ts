import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminLoginDto, DeviceAuthDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login with email and password' })
  @ApiResponse({ status: 200, description: 'JWT token for admin access' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.loginAdmin(dto);
  }

  @Public()
  @Post('device/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain JWT token for registered device' })
  @ApiResponse({ status: 200, description: 'JWT token for device access' })
  async deviceToken(@Body() dto: DeviceAuthDto) {
    return this.authService.authenticateDevice(dto);
  }
}
