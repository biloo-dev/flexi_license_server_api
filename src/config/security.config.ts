import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  jwtSecret: process.env.JWT_SECRET || 'flexi-secret-jwt-key-change-in-production-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
}));
