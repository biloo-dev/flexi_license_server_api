import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'cust_abc123' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsNotEmpty()
  deviceUuid: string;

  @ApiProperty({ example: 'FP-98A7B6C5D4E3F210' })
  @IsString()
  @IsNotEmpty()
  deviceFingerprint: string;

  @ApiPropertyOptional({ example: 'Flexi PC Main' })
  @IsString()
  @IsOptional()
  name?: string;
}

export class UpdateDeviceStatusDto {
  @ApiProperty({ enum: ['pending', 'active', 'suspended', 'blocked', 'revoked'], example: 'active' })
  @IsIn(['pending', 'active', 'suspended', 'blocked', 'revoked'])
  @IsNotEmpty()
  status: string;
}
