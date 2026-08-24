import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

import appConfig from './config/app.config';
import firebaseConfig from './config/firebase.config';
import securityConfig from './config/security.config';
import licenseConfig from './config/license.config';

import { DatabaseModule } from './database/database.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { OperatorsModule } from './modules/operators/operators.module';
import { DevicesModule } from './modules/devices/devices.module';
import { ModemsModule } from './modules/modems/modems.module';
import { SimsModule } from './modules/sims/sims.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ActivationsModule } from './modules/activations/activations.module';
import { SimAuthModule } from './modules/sim-auth/sim-auth.module';
import { FlexiModule } from './modules/flexi/flexi.module';
import { HeartbeatModule } from './modules/heartbeat/heartbeat.module';

import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, firebaseConfig, securityConfig, licenseConfig],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('security.throttleTtl') || 60,
          limit: config.get<number>('security.throttleLimit') || 100,
        },
      ],
    }),
    DatabaseModule,
    CryptoModule,
    AuditModule,
    AuthModule,
    CustomersModule,
    OperatorsModule,
    DevicesModule,
    ModemsModule,
    SimsModule,
    LicensesModule,
    PaymentsModule,
    ActivationsModule,
    SimAuthModule,
    FlexiModule,
    HeartbeatModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
