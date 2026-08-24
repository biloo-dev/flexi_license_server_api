import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HeartbeatModemDto {
  @ApiProperty({ example: '860123456789012' })
  @IsString()
  @IsNotEmpty()
  imei: string;

  @ApiPropertyOptional({ example: 'COM5' })
  @IsString()
  @IsOptional()
  port?: string;

  @ApiProperty({ example: '89213012345678901234' })
  @IsString()
  @IsNotEmpty()
  iccid: string;

  @ApiProperty({ example: 'DJZ' })
  @IsString()
  @IsNotEmpty()
  operator: string;
}

export class HeartbeatDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsNotEmpty()
  deviceUuid: string;

  @ApiProperty({ example: 'FP-98A7B6C5D4E3F210' })
  @IsString()
  @IsNotEmpty()
  deviceFingerprint: string;

  @ApiPropertyOptional({ example: '1.0.0', default: '1.0.0' })
  @IsString()
  @IsOptional()
  appVersion?: string;

  @ApiProperty({ type: [HeartbeatModemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeartbeatModemDto)
  modems: HeartbeatModemDto[];
}
