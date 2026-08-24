import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorCode } from '../constants/error-codes.constant';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected internal error occurred.';
    let details: Record<string, any> = {};

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details || {};
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        message = obj.message || exception.message;
        code = obj.code || this.mapStatusToErrorCode(status);
        if (Array.isArray(obj.message)) {
          code = ErrorCode.VALIDATION_ERROR;
          message = 'Validation failed';
          details = { errors: obj.message };
        } else {
          details = obj.details || {};
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
    });
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTH_REQUIRED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
