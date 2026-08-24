import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constant';

export class BusinessException extends HttpException {
  public readonly code: ErrorCode | string;
  public readonly details?: Record<string, any>;

  constructor(
    code: ErrorCode | string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
  ) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}
