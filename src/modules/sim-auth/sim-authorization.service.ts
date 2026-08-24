import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../database/firebase/firestore.service';
import { IccidService } from '../../crypto/iccid.service';
import { AuditService } from '../audit/audit.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { LicenseEvent } from '../../common/constants/events.constant';

export interface AuthorizeSimParams {
  customerId: string;
  deviceId: string;
  simId: string;
  operatorCode?: string;
  detectedIccid?: string;
  detectedIccidHash?: string;
  checkProgramAccess?: boolean;
}

export interface SimAuthorizationResult {
  authorized: boolean;
  programAccess: boolean;
  simAuthorized: boolean;
  customer: any;
  device: any;
  sim: any;
  modem: any;
  license: any;
  reason?: string;
}

@Injectable()
export class SimAuthorizationService {
  private readonly logger = new Logger(SimAuthorizationService.name);

  constructor(
    private readonly firestore: FirestoreService,
    private readonly iccidService: IccidService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Evaluates Level 1 Program Access:
   * Returns true if ALL customer's SIM cards that have `requiredForAccess: true` are 'active'.
   */
  async checkProgramAccess(customerId: string): Promise<{ access: boolean; requiredSims: any[]; inactiveSims: any[] }> {
    const requiredSims = await this.firestore.find('sim_cards', [
      { field: 'customerId', op: '==', value: customerId },
      { field: 'requiredForAccess', op: '==', value: true },
    ]);

    // If customer has no required SIMs defined, default to true
    if (requiredSims.length === 0) {
      return { access: true, requiredSims: [], inactiveSims: [] };
    }

    const inactiveSims = requiredSims.filter((s) => s.status !== 'active');
    const access = inactiveSims.length === 0;

    return {
      access,
      requiredSims,
      inactiveSims,
    };
  }

  /**
   * Two-Level SIM Authorization Engine:
   * Level 1: Program Access (all required SIMs active)
   * Level 2: Per-SIM Authorization (Customer, Device, Modem, SIM, License, ICCID, Operator)
   */
  async authorizeSim(params: AuthorizeSimParams): Promise<SimAuthorizationResult> {
    const { customerId, deviceId, simId, operatorCode, detectedIccid, detectedIccidHash } = params;

    // 1. Verify Customer
    const customer = await this.firestore.getDoc('customers', customerId);
    if (!customer) {
      return this.fail(params, ErrorCode.CUSTOMER_NOT_FOUND, `Customer '${customerId}' not found`);
    }
    if (customer.status !== 'active') {
      return this.fail(params, ErrorCode.CUSTOMER_INACTIVE, `Customer is ${customer.status}`);
    }

    // 2. Verify Device
    const device = await this.firestore.getDoc('devices', deviceId);
    if (!device) {
      return this.fail(params, ErrorCode.DEVICE_NOT_FOUND, `Device '${deviceId}' not found`);
    }
    if (device.status !== 'active') {
      return this.fail(params, ErrorCode.DEVICE_BLOCKED, `Device is ${device.status}`);
    }
    if (device.customerId !== customerId) {
      return this.fail(params, ErrorCode.DEVICE_MISMATCH, 'Device does not belong to this customer');
    }

    // 3. Level 1: Check Program Access (if enabled)
    const programCheck = await this.checkProgramAccess(customerId);
    if (params.checkProgramAccess !== false && !programCheck.access) {
      const inactiveNames = programCheck.inactiveSims.map((s) => s.operatorId).join(', ');
      return this.fail(
        params,
        ErrorCode.REQUIRED_SIMS_INACTIVE,
        `Program access denied. Required SIMs are not active: [${inactiveNames}]`,
        { programAccess: false },
      );
    }

    // 4. Verify SIM Card
    const sim = await this.firestore.getDoc('sim_cards', simId);
    if (!sim) {
      return this.fail(params, ErrorCode.SIM_NOT_FOUND, `SIM card '${simId}' not found`);
    }
    if (sim.customerId !== customerId) {
      return this.fail(params, ErrorCode.SIM_NOT_AUTHORIZED, 'SIM card does not belong to this customer');
    }
    if (sim.status !== 'active') {
      return this.fail(params, ErrorCode.SIM_NOT_ACTIVATED, `SIM card status is '${sim.status}'`);
    }

    // 5. Verify Modem Binding
    const binding = await this.firestore.findOne('sim_bindings', [
      { field: 'simCardId', op: '==', value: simId },
      { field: 'status', op: '==', value: 'active' },
    ]);
    if (!binding) {
      return this.fail(params, ErrorCode.SIM_NOT_BOUND, `SIM card is not bound to any active modem`);
    }

    const modem = await this.firestore.getDoc('modems', binding.modemId);
    if (!modem || modem.status !== 'active') {
      return this.fail(params, ErrorCode.MODEM_BLOCKED, `Modem bound to SIM is inactive or blocked`);
    }
    if (modem.deviceId !== deviceId) {
      return this.fail(params, ErrorCode.DEVICE_MISMATCH, 'Modem is bound to a different device');
    }

    // 6. Verify ICCID SHA-256 Hash
    if (detectedIccid) {
      const matches = this.iccidService.verifyIccid(detectedIccid, sim.iccidHash);
      if (!matches) {
        return this.fail(params, ErrorCode.ICCID_MISMATCH, 'Detected ICCID does not match SIM record');
      }
    } else if (detectedIccidHash) {
      if (detectedIccidHash.toLowerCase() !== sim.iccidHash.toLowerCase()) {
        return this.fail(params, ErrorCode.ICCID_MISMATCH, 'Detected ICCID hash does not match SIM record');
      }
    }

    // 7. Verify Operator
    if (operatorCode) {
      const operatorDoc = await this.firestore.getDoc('operators', sim.operatorId);
      if (!operatorDoc || operatorDoc.code.toUpperCase() !== operatorCode.toUpperCase()) {
        return this.fail(
          params,
          ErrorCode.OPERATOR_MISMATCH,
          `SIM operator (${sim.operatorId}) does not match requested operator '${operatorCode}'`,
        );
      }
    }

    // 8. Verify Active License
    const license = await this.firestore.findOne('licenses', [
      { field: 'simCardId', op: '==', value: simId },
      { field: 'deviceId', op: '==', value: deviceId },
      { field: 'status', op: '==', value: 'active' },
    ]);

    if (!license) {
      return this.fail(params, ErrorCode.LICENSE_NOT_FOUND, 'No active license found for this SIM and Device');
    }

    // Check expiration
    const now = new Date();
    const expiryDate = license.expiresAt?.toDate ? license.expiresAt.toDate() : new Date(license.expiresAt);
    if (expiryDate < now) {
      return this.fail(
        params,
        ErrorCode.LICENSE_EXPIRED,
        `License expired on ${expiryDate.toISOString()}`,
      );
    }

    // All conditions passed -> AUTHORIZED
    await this.auditService.logEvent({
      licenseId: license.id,
      simCardId: sim.id,
      deviceId: device.id,
      customerId: customer.id,
      event: LicenseEvent.OPERATION_ALLOWED,
      metadata: {
        operator: operatorCode || sim.operatorId,
        iccidLast4: sim.iccidLast4,
      },
    });

    return {
      authorized: true,
      programAccess: true,
      simAuthorized: true,
      customer,
      device,
      sim,
      modem,
      license,
    };
  }

  private async fail(
    params: AuthorizeSimParams,
    code: ErrorCode | string,
    reason: string,
    extra: Record<string, any> = {},
  ): Promise<SimAuthorizationResult> {
    this.logger.warn(`SIM Authorization failed [${code}]: ${reason}`);

    await this.auditService.logEvent({
      simCardId: params.simId,
      deviceId: params.deviceId,
      customerId: params.customerId,
      event: LicenseEvent.OPERATION_BLOCKED,
      metadata: {
        errorCode: code,
        reason,
        ...extra,
      },
    });

    throw new BusinessException(code, reason, 403, extra);
  }
}
