// Created automatically by Cursor AI (2024-12-19)

import { ApiProperty } from '@nestjs/swagger';
import { BudgetPeriod } from '../entities/budget.entity';

export class BudgetLineResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  spent: number;

  @ApiProperty()
  remaining: number;

  @ApiProperty()
  percentageUsed: number;

  @ApiProperty()
  rollover: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class BudgetResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  householdId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: BudgetPeriod })
  period: BudgetPeriod;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  buffer: number;

  @ApiProperty()
  visibleAccountIds: string[];

  @ApiProperty()
  isShared: boolean;

  @ApiProperty()
  totalBudget: number;

  @ApiProperty()
  totalSpent: number;

  @ApiProperty()
  totalRemaining: number;

  @ApiProperty()
  safeToSpend: number;

  @ApiProperty()
  percentageUsed: number;

  @ApiProperty({ type: [BudgetLineResponseDto] })
  budgetLines: BudgetLineResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
