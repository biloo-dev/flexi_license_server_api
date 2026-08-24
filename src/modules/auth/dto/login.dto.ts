import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, MinLength, IsOptional } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@flexi.dz' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'AdminPassword123!' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class DeviceAuthDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsNotEmpty()
  deviceUuid: string;

  @ApiProperty({ example: 'FP-98A7B6C5D4E3F210' })
  @IsString()
  @IsNotEmpty()
  deviceFingerprint: string;

  @ApiPropertyOptional({ example: 'Flexi PC 1' })
  @IsString()
  @IsOptional()
  name?: string;
}
