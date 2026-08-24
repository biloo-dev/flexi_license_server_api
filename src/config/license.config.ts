import { registerAs } from '@nestjs/config';

export default registerAs('license', () => ({
  activeKeyId: process.env.LICENSE_KEY_ID || '2026-01',
  privateKey: process.env.LICENSE_PRIVATE_KEY
    ? process.env.LICENSE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '',
  publicKey: process.env.LICENSE_PUBLIC_KEY
    ? process.env.LICENSE_PUBLIC_KEY.replace(/\\n/g, '\n')
    : '',
  offlineGracePeriodHours: parseInt(
    process.env.LICENSE_OFFLINE_GRACE_PERIOD_HOURS || '48',
    10,
  ),
  defaultValidityDays: parseInt(
    process.env.LICENSE_DEFAULT_VALIDITY_DAYS || '365',
    10,
  ),
}));
