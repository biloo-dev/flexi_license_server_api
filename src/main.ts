import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : (configService.get<number>('app.port') || 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';
  const corsOrigins = configService.get<string | string[]>('app.corsOrigins') || '*';

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  // CORS
  app.enableCors({
    origin: (origin, callback) => {
      // Allow any origin dynamically so Access-Control-Allow-Origin echoes back the request origin
      callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With,Origin',
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/', 'health'],
  });

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('FLEXI LICENSE SERVER API')
    .setDescription(
      'Production-Ready Enterprise Licensing Server for Flexi Desktop (Flutter) GSM Modems, Cloud Firestore & Ed25519 Cryptography',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints for Admins and Devices')
    .addTag('Operators', 'Cellular operators management (Djezzy, Mobilis, Ooredoo)')
    .addTag('Devices', 'Device registration, hardware binding, and heartbeat')
    .addTag('Modems', 'GSM Modem hardware tracking and port mapping')
    .addTag('Licenses', 'Client license activation and query')
    .addTag('Flexi Operations', 'Real-time authorized flexi operations execution')
    .addTag('Admin - Customers', 'Customer profiles management')
    .addTag('Admin - Devices', 'Device authorization management')
    .addTag('Admin - SIM Cards', 'SIM card registration, ICCID hashing, and modem binding')
    .addTag('Admin - Licenses', 'License lifecycle (issue, revoke, renew, suspend, reactivate)')
    .addTag('Admin - Payments', 'Payment confirmation and atomic license generation')
    .addTag('Admin - Audit Logs', 'Tamper-evident audit trail and license event query')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Flexi License Server - Swagger UI',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`=======================================================`);
  logger.log(`🚀 Flexi License Server is running on port ${port} (0.0.0.0) with prefix: /${apiPrefix}`);
  logger.log(`📚 Swagger Documentation is live at: /api/docs`);
  logger.log(`=======================================================`);
}

bootstrap();
