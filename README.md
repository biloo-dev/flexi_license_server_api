# FLEXI LICENSE SERVER

Production-Ready, Enterprise-Grade Licensing & SIM Authorization Backend for **Flexi Desktop (Flutter)** GSM Modem Operations in Algeria (Djezzy, Mobilis, Ooredoo).

Built with **NestJS**, **TypeScript**, **Node.js 22+**, **Google Cloud Firestore (Firebase Admin SDK)**, and **Ed25519 Digital Signatures**.

---

## Table of Contents
- [Architecture & Design Principles](#architecture--design-principles)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Prerequisites & Environment Setup](#prerequisites--environment-setup)
- [Firestore Migration & Seed System](#firestore-migration--seed-system)
- [Ed25519 Cryptography & License Structure](#ed25519-cryptography--license-structure)
- [License Lifecycle & Business Flows](#license-lifecycle--business-flows)
- [Two-Level SIM Authorization Engine](#two-level-sim-authorization-engine)
- [Device Heartbeat & Offline Grace Period](#device-heartbeat--offline-grace-period)
- [Idempotent Flexi Recharge Operations](#idempotent-flexi-recharge-operations)
- [CLI Commands](#cli-commands)
- [API Documentation (Swagger)](#api-documentation-swagger)
- [Standardized Response & Error Format](#standardized-response--error-format)
- [Running Automated Tests](#running-automated-tests)
- [Docker Deployment](#docker-deployment)
- [Security & Production Best Practices](#security--production-best-practices)

---

## Architecture & Design Principles

1. **Zero-Trust Client Design:** Flutter client is never trusted as the source of truth. All cryptographic signatures, device bindings, modem IMEIs, and SIM ICCID hashes are strictly validated on the NestJS server before any Flexi operation is authorized.
2. **Cloud Firestore without SQL:** Uses a custom, idempotent, document-based migration runner (`_system/migrations`) and transactional atomic workflows.
3. **Pure Ed25519 Signatures:** Built directly on Node 22 native `crypto` with RFC 8785 JSON Canonicalization Scheme (JCS) to eliminate signature drift across operating systems.
4. **Data Privacy:** Full raw ICCIDs and passwords are never logged or stored plaintext. ICCIDs are hashed using SHA-256 (`SHA256(rawIccid)`), with only the last 4 digits stored for human identification.

---

## Project Structure

```
src/
├── app.module.ts
├── main.ts
│
├── config/
│   ├── app.config.ts             # Port, Environment, CORS
│   ├── firebase.config.ts        # Firebase Admin credentials
│   ├── security.config.ts        # JWT & Throttler rate limits
│   └── license.config.ts         # Active Ed25519 Key ID, Grace period
│
├── common/
│   ├── constants/
│   │   ├── error-codes.constant.ts # Standard error codes
│   │   ├── events.constant.ts      # Audit event types
│   │   └── roles.constant.ts       # ADMIN, CUSTOMER, DEVICE
│   ├── decorators/               # @Public(), @Roles(), @CurrentUser()
│   ├── dto/                      # Standard ApiResponseDto wrapper
│   ├── exceptions/               # BusinessException
│   ├── filters/                  # AllExceptionsFilter
│   ├── guards/                   # AuthGuard, RolesGuard, DeviceGuard
│   ├── interceptors/             # TransformResponseInterceptor, AuditInterceptor
│   └── utils/                    # Base64URL encoding/decoding
│
├── crypto/
│   ├── ed25519.service.ts          # Keypair gen, Sign, Verify (Node 22)
│   ├── canonical-json.service.ts   # RFC 8785 JSON Canonicalization Scheme
│   ├── iccid.service.ts            # SHA-256 ICCID hashing & verification
│   ├── license-signature.service.ts# Serial format FX1.<payload>.<sig>
│   ├── license-generator.service.ts# Payload builder & signer
│   └── license-verifier.service.ts # 12-point comprehensive verifier
│
├── database/
│   ├── firebase/                   # FirebaseService & FirestoreService
│   ├── migrations/                 # 12 Idempotent migrations + Runner
│   └── seeds/                      # Operators seed (Djezzy, Mobilis, Ooredoo)
│
├── cli/
│   └── cli.ts                      # CLI entrypoint for migrations, keys, licenses
│
└── modules/
    ├── auth/                       # JWT & Firebase Auth token verification
    ├── customers/                  # Customer management
    ├── operators/                  # Djezzy (DJZ), Mobilis (MOB), Ooredoo (OOR)
    ├── devices/                    # UUID + Hardware Fingerprint registration
    ├── modems/                     # Modem IMEI tracking & port mapping
    ├── sims/                       # SIM card registration & modem bindings
    ├── licenses/                   # Admin license lifecycle (issue, revoke, renew)
    ├── payments/                   # Payment confirmation & atomic license issuance
    ├── activations/                # Client license activation flow
    ├── sim-auth/                   # Two-Level SIM authorization engine
    ├── flexi/                      # Flexi operations execution & Idempotency
    ├── heartbeat/                  # Device heartbeat & 48h signed offline tokens
    └── audit/                      # Audit logs & license_events trail
```

---

## Prerequisites & Environment Setup

### 1. Prerequisites
- **Node.js**: v22.0.0 or later
- **npm**: v10+
- **Firebase Project**: A Google Cloud Firebase project with Cloud Firestore enabled (or Firestore Emulator).

### 2. Environment Configuration
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Configure your `.env` variables:
```ini
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Firebase Credentials
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Ed25519 Licensing Key
LICENSE_KEY_ID=2026-01
LICENSE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
LICENSE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

LICENSE_OFFLINE_GRACE_PERIOD_HOURS=48
JWT_SECRET=your-secure-jwt-secret
```

---

## Firestore Migration & Seed System

Since Cloud Firestore is a NoSQL document database without native DDL migrations, this server includes a custom migration engine storing migration records in `_system/migrations`.

### 1. Run Migrations
Executes all 12 collection schemas in sequence idempotently:
```bash
npm run migration:run
```
*If executed multiple times, previously executed migrations are safely skipped.*

### 2. Check Migration Status
```bash
npm run migration:status
```

### 3. Safe Rollback
Rolls back the last `N` migrations safely without deleting user collections:
```bash
npm run migration:rollback 1
```

### 4. Seed Cellular Operators
Seeds **Djezzy** (`DJZ`), **Mobilis** (`MOB`), and **Ooredoo** (`OOR`):
```bash
npm run seed
```

---

## Ed25519 Cryptography & License Structure

### 1. Key Generation
Generate a fresh Ed25519 key pair with Key ID:
```bash
npm run license:generate-key 2026-01
```

### 2. License Payload Structure
```json
{
  "v": 1,
  "kid": "2026-01",
  "licenseId": "lic_550e8400-e29b-41d4-a716-446655440000",
  "simId": "sim_7890",
  "operator": "DJZ",
  "iccidHash": "3bf33518dc63ba9c7da79e6224f9788be9ffff13c267bfd5f35f4c1b52bf1f8f",
  "deviceId": "dev_pc_main",
  "features": ["FLEXI"],
  "iat": 1787236022,
  "exp": 1818772022
}
```

### 3. Serial Format
```
FX1.<base64url(canonical_payload)>.<base64url(ed25519_signature)>
```

### 4. 12-Point License Verification
The `LicenseVerifierService` executes a rigorous 12-point check:
1. Format & segment validation (`FX1.payload.signature`)
2. Payload deserialization
3. Key ID lookup (supporting key rotation)
4. Public key resolution
5. Ed25519 cryptographic digital signature verification
6. Schema completeness
7. Expiration date (`exp > now`)
8. Database status (`active`, not `revoked` / `suspended`)
9. ICCID SHA-256 hash match
10. Bound Device ID match
11. Cellular Operator match
12. Permitted features array check

---

## License Lifecycle & Business Flows

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    actor Admin
    participant Flutter as Flexi Desktop (Flutter)
    participant NestJS as Flexi License Server
    participant Firestore as Cloud Firestore

    Admin->>NestJS: POST /admin/sims (Register ICCID)
    Customer->>Admin: Pays for license
    Admin->>NestJS: POST /admin/payments/:id/confirm
    NestJS->>NestJS: Generate Ed25519 License & Sign
    NestJS->>Firestore: Atomic Transaction: Payment PAID + License ACTIVE + SIM ACTIVE
    NestJS-->>Admin: Returns License Serial (FX1...)
    Admin-->>Customer: Delivers License Serial

    Flutter->>Flutter: Read SIM ICCID from GSM Modem (AT+CCID)
    Flutter->>NestJS: POST /licenses/activate (Serial, Device UUID, Modem IMEI, ICCID)
    NestJS->>NestJS: 12-Point Ed25519 Verification & ICCID Match
    NestJS->>Firestore: Store Activation Doc + Bind SIM to Modem
    NestJS-->>Flutter: Activation Success (48h Offline Grace Token)
```

---

## Two-Level SIM Authorization Engine

Before sending any Flexi operation, the system verifies two levels of authorization:

### Level 1: Program Access (`allRequiredSimsActive`)
- If a customer has defined required SIM cards (e.g. Djezzy = true, Mobilis = true, Ooredoo = true), **ALL** required SIMs must be in `active` status for the program to grant recharge access.

### Level 2: Per-SIM Authorization (`isSpecificSimAuthorized`)
- Verifies:
  - Customer status is `active`
  - Device status is `active` and matches registration
  - SIM status is `active` and belongs to this customer
  - SIM is bound to an active modem on this device
  - Active, unexpired Ed25519 license exists
  - Detected ICCID SHA-256 matches stored hash
  - Cellular operator matches

---

## Device Heartbeat & Offline Grace Period

- **Endpoint**: `POST /api/v1/devices/heartbeat`
- **Interval**: Client sends regular heartbeats reporting attached modems, ports, and detected ICCIDs.
- **Offline Mode (48 Hours)**: When the server is reached, it issues an Ed25519 digitally signed offline state token (`FXS1...`). If the device loses internet connection, Flutter validates the token locally and allows operations for up to **48 hours** before blocking.

---

## Idempotent Flexi Recharge Operations

- **Endpoint**: `POST /api/v1/flexi/operations`
- Every request must provide a unique `idempotencyKey` (e.g. `tx-20260820-00129`).
- If an operation with the same idempotency key was already executed, the server **skips re-execution** and returns the previous result, preventing accidental duplicate recharges.

---

## CLI Commands

| Command | Description |
|---|---|
| `npm run migration:run` | Runs all pending Firestore migrations |
| `npm run migration:status` | Shows status table of all migrations |
| `npm run migration:rollback [N]` | Reverts last N migrations safely |
| `npm run seed` | Seeds default operators (Djezzy, Mobilis, Ooredoo) |
| `npm run license:generate-key [kid]` | Generates a new Ed25519 keypair |
| `npm run license:generate <licId> <simId> <op> <iccid> <devId>` | Generates and signs a license serial |

---

## API Documentation (Swagger)

Interactive Swagger / OpenAPI 3.0 documentation is accessible at:
```
http://localhost:3000/api/docs
```

---

## Standardized Response & Error Format

### Success Response:
```json
{
  "success": true,
  "data": {
    "operationId": "op_98765",
    "status": "success",
    "amount": 1000,
    "phoneNumber": "0770123456",
    "operator": "DJZ",
    "idempotencyKey": "tx-001"
  }
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "SIM_NOT_AUTHORIZED",
    "message": "SIM is not authorized for this device.",
    "details": {}
  }
}
```

---

## Running Automated Tests

Run the complete Jest unit and integration test suite:
```bash
npm test
```

Run test coverage report:
```bash
npm run test:cov
```

---

## Docker Deployment

### 1. Build & Run with Docker Compose
```bash
docker-compose up -d --build
```

### 2. Multi-Stage Dockerfile
The provided `Dockerfile` uses a lightweight, secure Node 22 Alpine multi-stage build.

---

## Security & Production Best Practices

1. **Private Key Protection:** Never commit private keys to Git or store them in Firestore. Store private keys in Google Cloud Secret Manager or KMS.
2. **Firestore Direct Access Disabled:** `firestore.rules` blocks all direct client read/writes. Access occurs exclusively through the NestJS backend via Firebase Admin SDK.
3. **Rate Limiting:** Throttler limits requests on authentication, activations, heartbeats, and operations.
4. **Tamper-Evident Audit Trail:** Every sensitive action (creation, activation, revocation, authorization blocks) is recorded in `license_events`.
