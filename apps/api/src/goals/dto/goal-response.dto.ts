// Created automatically by Cursor AI (2024-12-19)

import { ApiProperty } from '@nestjs/swagger';

export class GoalSuggestionDto {
  @ApiProperty()
  suggestedMonthlyContribution: number;

  @ApiProperty()
  suggestedWeeklyContribution: number;

  @ApiProperty()
  suggestedDailyContribution: number;

  @ApiProperty()
  projectedCompletionDate: Date;

  @ApiProperty()
  isOnTrack: boolean;

  @ApiProperty()
  projectedShortfall: number;
}

export class GoalWhatIfDto {
  @ApiProperty()
  monthlyContribution: number;

  @ApiProperty()
  projectedCompletionDate: Date;

  @ApiProperty()
  totalContribution: number;

  @ApiProperty()
  projectedAmount: number;
}

export class GoalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  householdId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  targetAmount: number;

  @ApiProperty()
  targetDate: Date;

  @ApiProperty()
  accountId: string;

  @ApiProperty()
  accountName: string;

  @ApiProperty()
  currentAmount: number;

  @ApiProperty()
  monthlyContribution: number;

  @ApiProperty()
  description: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  tags: string[];

  @ApiProperty()
  progressPercentage: number;

  @ApiProperty()
  remainingAmount: number;

  @ApiProperty()
  daysRemaining: number;

  @ApiProperty()
  isOnTrack: boolean;

  @ApiProperty()
  suggestions: GoalSuggestionDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
