import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';

export class CreateLicenseDto {
  @ApiPropertyOptional({ example: 'cust_abc123' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ example: 'sim_abc123' })
  @IsString()
  @IsNotEmpty()
  simCardId: string;

  @ApiPropertyOptional({ example: 'dev_abc123' })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({ example: 365, default: 365 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  validityDays?: number;

  @ApiPropertyOptional({ example: ['FLEXI'], default: ['FLEXI'] })
  @IsArray()
  @IsOptional()
  features?: string[];
}

export class RenewLicenseDto {
  @ApiPropertyOptional({ example: 365, default: 365 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  additionalDays?: number;
}
