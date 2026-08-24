import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsIn,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'cust_abc123' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: 'sim_abc123', description: 'The SIM card this payment is for licensing' })
  @IsString()
  @IsNotEmpty()
  simCardId: string;

  @ApiProperty({ example: 'dev_abc123', description: 'The device ID the license will bind to' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'DZD', default: 'DZD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 'PAY-2026-001' })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiPropertyOptional({ example: 365, default: 365 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  validityDays?: number;
}
