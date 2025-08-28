// Created automatically by Cursor AI (2024-12-19)

import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBudgetLineDto {
  @ApiProperty({ description: 'Category ID for this budget line' })
  @IsString()
  categoryId: string;

  @ApiProperty({ description: 'Budget amount for this category' })
  @IsNumber()
  @Min(0)
  @Max(999999999.99)
  amount: number;

  @ApiProperty({ description: 'Whether to rollover unused amount to next period', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  rollover?: boolean;
}
