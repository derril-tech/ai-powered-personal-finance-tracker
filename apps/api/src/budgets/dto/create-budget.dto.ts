// Created automatically by Cursor AI (2024-12-19)

import { IsString, IsEnum, IsDateString, IsNumber, IsOptional, Min, Max, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BudgetPeriod } from '../entities/budget.entity';

export class CreateBudgetDto {
  @ApiProperty({ description: 'Budget name' })
  @IsString()
  name: string;

  @ApiProperty({ enum: BudgetPeriod, description: 'Budget period' })
  @IsEnum(BudgetPeriod)
  period: BudgetPeriod;

  @ApiProperty({ description: 'Budget start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Buffer amount for the budget', required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999999.99)
  buffer?: number;

  @ApiProperty({ description: 'Account IDs that are visible in this budget', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleAccountIds?: string[];

  @ApiProperty({ description: 'Whether this budget is shared across household members', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}
