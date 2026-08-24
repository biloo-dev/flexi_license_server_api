import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ActivateLicenseDto {
  @ApiProperty({
    example: 'FX1.eyJ2IjoxLCJraWQiOiIyMDI2LTAxIi...signature',
    description: 'The full Ed25519-signed license serial string',
  })
  @IsString()
  @IsNotEmpty()
  licenseSerial: string;

  @ApiProperty({ example: 'dev_abc123', description: 'Device ID on server or deviceUuid' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: '860123456789012', description: 'IMEI of the GSM Modem' })
  @IsString()
  @IsNotEmpty()
  imei: string;

  @ApiProperty({
    example: '89213012345678901234',
    description: 'Raw ICCID read from the SIM card via AT+CCID command in Flutter',
  })
  @IsString()
  @IsNotEmpty()
  iccid: string;

  @ApiPropertyOptional({ example: '1.0.0', default: '1.0.0' })
  @IsString()
  @IsOptional()
  appVersion?: string;
}
