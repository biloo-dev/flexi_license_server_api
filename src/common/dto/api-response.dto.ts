import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from '../constants/error-codes.constant';

export class ApiErrorDetailDto {
  @ApiProperty({ enum: ErrorCode, example: ErrorCode.SIM_NOT_AUTHORIZED })
  code: string;

  @ApiProperty({ example: 'SIM is not authorized.' })
  message: string;

  @ApiPropertyOptional({ example: {} })
  details?: Record<string, any>;
}

export class ApiResponseDto<T = any> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional({ type: ApiErrorDetailDto })
  error?: ApiErrorDetailDto;

  static success<T>(data: T): ApiResponseDto<T> {
    return {
      success: true,
      data,
    };
  }

  static error(
    code: string | ErrorCode,
    message: string,
    details: Record<string, any> = {},
  ): ApiResponseDto {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };
  }
}
