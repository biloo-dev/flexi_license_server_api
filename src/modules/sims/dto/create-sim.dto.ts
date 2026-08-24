import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateSimDto {
  @ApiProperty({ example: 'cust_abc123' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ enum: ['djezzy', 'mobilis', 'ooredoo'], example: 'djezzy' })
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @ApiProperty({ example: '89213012345678901234', description: 'Raw ICCID from SIM. Will be hashed using SHA256 before storing.' })
  @IsString()
  @IsNotEmpty()
  iccid: string;

  @ApiPropertyOptional({ example: '0770123456' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  requiredForAccess?: boolean;

  @ApiPropertyOptional({ enum: ['pending', 'active', 'blocked', 'suspended', 'expired', 'revoked'], default: 'pending' })
  @IsIn(['pending', 'active', 'blocked', 'suspended', 'expired', 'revoked'])
  @IsOptional()
  status?: string;
}

export class BindSimDto {
  @ApiProperty({ example: 'modem_abc123' })
  @IsString()
  @IsNotEmpty()
  modemId: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  slot?: number;
}

export class UpdateSimStatusDto {
  @ApiProperty({ enum: ['pending', 'active', 'blocked', 'suspended', 'expired', 'revoked'], example: 'active' })
  @IsIn(['pending', 'active', 'blocked', 'suspended', 'expired', 'revoked'])
  @IsNotEmpty()
  status: 'pending' | 'active' | 'blocked' | 'suspended' | 'expired' | 'revoked';
}

export class TransferSimOwnerDto {
  @ApiProperty({ example: 'cust_xyz789', description: 'ID of the new customer who will own this SIM' })
  @IsString()
  @IsNotEmpty()
  newCustomerId: string;
}

export class UpdateSimDto {
  @ApiPropertyOptional({ example: '0770123456' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: ['djezzy', 'mobilis', 'ooredoo'], example: 'djezzy' })
  @IsString()
  @IsOptional()
  operatorId?: string;

  @ApiPropertyOptional({ example: '89213012345678901234' })
  @IsString()
  @IsOptional()
  iccid?: string;

  @ApiPropertyOptional({ enum: ['pending', 'active', 'blocked', 'suspended', 'expired', 'revoked'] })
  @IsIn(['pending', 'active', 'blocked', 'suspended', 'expired', 'revoked'])
  @IsOptional()
  status?: string;
}
