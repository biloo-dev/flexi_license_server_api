import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsIn,
} from 'class-validator';

export class CreateFlexiOperationDto {
  @ApiProperty({ example: 'cust_abc123' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: 'dev_abc123' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: 'sim_abc123' })
  @IsString()
  @IsNotEmpty()
  simCardId: string;

  @ApiProperty({ enum: ['djezzy', 'mobilis', 'ooredoo'], example: 'djezzy' })
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @ApiProperty({ example: '0770123456', description: 'Recipient phone number' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'flexi', default: 'flexi' })
  @IsString()
  @IsOptional()
  operationType?: string;

  @ApiProperty({ example: 1000, description: 'Flexi recharge amount in DZD' })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({
    example: '89213012345678901234',
    description: 'Raw ICCID detected on modem for runtime hardware verification',
  })
  @IsString()
  @IsNotEmpty()
  detectedIccid: string;

  @ApiProperty({
    example: 'idemp-tx-20260820-001',
    description: 'Unique client-side idempotency key to prevent double execution',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
