import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('security.jwtSecret') || 'flexi-secret-jwt-key-change-in-production-2026',
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      userId: payload.sub,
      role: payload.role,
      email: payload.email,
      customerId: payload.customerId,
      deviceId: payload.deviceId,
      deviceUuid: payload.deviceUuid,
    };
  }
}
