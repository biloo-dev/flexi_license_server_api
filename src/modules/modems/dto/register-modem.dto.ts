import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';

export class RegisterModemDto {
  @ApiProperty({ example: 'dev_12345' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: '860123456789012' })
  @IsString()
  @IsNotEmpty()
  imei: string;

  @ApiPropertyOptional({ example: 'COM5' })
  @IsString()
  @IsOptional()
  port?: string;

  @ApiPropertyOptional({ example: 'QUECTEL' })
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'EC25' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: 'GSM Modem 1' })
  @IsString()
  @IsOptional()
  name?: string;
}

export class UpdateModemStatusDto {
  @ApiProperty({ enum: ['active', 'blocked', 'inactive'], example: 'active' })
  @IsIn(['active', 'blocked', 'inactive'])
  @IsNotEmpty()
  status: string;
}
