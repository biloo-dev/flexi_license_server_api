import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, IsIn } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'ABC Store' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '0550000000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'store@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'SARL Telecom DZ' })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiPropertyOptional({ example: 'Algiers, Algeria' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ enum: ['active', 'suspended', 'blocked', 'deleted'], default: 'active' })
  @IsIn(['active', 'suspended', 'blocked', 'deleted'])
  @IsOptional()
  status?: string;
}

export class UpdateCustomerStatusDto {
  @ApiProperty({ enum: ['active', 'suspended', 'blocked', 'deleted'], example: 'active' })
  @IsIn(['active', 'suspended', 'blocked', 'deleted'])
  @IsNotEmpty()
  status: string;
}
