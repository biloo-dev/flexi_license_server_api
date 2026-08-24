import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App;
  private dbInstance: Firestore;
  private authInstance: Auth;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      this.app = existingApps[0]!;
      this.dbInstance = getFirestore(this.app);
      this.authInstance = getAuth(this.app);
      return;
    }

    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');
    const emulatorHost = this.configService.get<string>('firebase.emulatorHost');

    if (emulatorHost) {
      process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
      this.logger.log(`Using Firestore Emulator at ${emulatorHost}`);
    }

    const fs = require('fs');
    const path = require('path');
    
    const candidatePaths = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      process.env.FIREBASE_CREDENTIALS_PATH,
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(process.cwd(), 'serviceAccountKey.json.json'),
      path.resolve(__dirname, '../../../serviceAccountKey.json'),
      path.resolve(__dirname, '../../../../serviceAccountKey.json'),
      path.resolve(__dirname, '../../serviceAccountKey.json'),
      path.resolve(__dirname, '../serviceAccountKey.json'),
    ].filter(Boolean) as string[];

    let serviceAccountPath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        serviceAccountPath = p;
        break;
      }
    }

    if (serviceAccountPath) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
        process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
        this.app = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        });
        this.logger.log(`Initialized Firebase Admin SDK using ${serviceAccountPath} for project ${serviceAccount.project_id || projectId}`);
      } catch (err: any) {
        this.logger.error(`Error loading service account file (${serviceAccountPath}): ${err.message}`);
      }
    } else if (projectId && clientEmail && privateKey) {
      try {
        this.app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.logger.log(`Initialized Firebase Admin SDK for project ${projectId}`);
      } catch (err: any) {
        this.logger.error(
          `Failed to initialize Firebase with service account credentials: ${err.message}`,
        );
      }
    } else {
      this.logger.error(
        'CRITICAL: No valid Firebase service account found! Firestore queries will fail with UNAUTHENTICATED. Place serviceAccountKey.json in the project root or configure FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.',
      );
      this.app = initializeApp({
        projectId: projectId || 'flexy-license',
      });
    }

    this.dbInstance = getFirestore(this.app);
    this.authInstance = getAuth(this.app);

    this.dbInstance.settings({ ignoreUndefinedProperties: true });
  }

  getFirestore(): Firestore {
    if (!this.dbInstance) {
      this.initializeFirebase();
    }
    return this.dbInstance;
  }

  getAuth(): Auth {
    if (!this.authInstance) {
      this.initializeFirebase();
    }
    return this.authInstance;
  }

  getApp(): App {
    if (!this.app) {
      this.initializeFirebase();
    }
    return this.app;
  }
}
