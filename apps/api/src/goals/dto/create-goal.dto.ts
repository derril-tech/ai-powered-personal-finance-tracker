// Created automatically by Cursor AI (2024-12-19)

import { IsString, IsNumber, IsDateString, IsOptional, Min, Max, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGoalDto {
  @ApiProperty({ description: 'Goal name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Target amount for the goal' })
  @IsNumber()
  @Min(0.01)
  @Max(999999999.99)
  targetAmount: number;

  @ApiProperty({ description: 'Target date for the goal' })
  @IsDateString()
  targetDate: string;

  @ApiProperty({ description: 'Account ID for the goal' })
  @IsString()
  accountId: string;

  @ApiProperty({ description: 'Current amount saved', required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999999.99)
  currentAmount?: number;

  @ApiProperty({ description: 'Monthly contribution amount', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999999.99)
  monthlyContribution?: number;

  @ApiProperty({ description: 'Goal description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Whether the goal is active', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Tags for the goal', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
