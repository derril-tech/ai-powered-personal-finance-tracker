# Created automatically by Cursor AI (2024-12-19)

import { IsString, IsNumber, IsDateString, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({ description: 'Transaction date' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Transaction amount' })
  @IsNumber()
  @Min(-999999999.99)
  @Max(999999999.99)
  amount: number;

  @ApiProperty({ description: 'Transaction description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Merchant name', required: false })
  @IsOptional()
  @IsString()
  merchant_name?: string;

  @ApiProperty({ description: 'Account ID' })
  @IsString()
  account_id: string;

  @ApiProperty({ description: 'Category ID', required: false })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiProperty({ description: 'Whether this is a transfer', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_transfer?: boolean;
}
