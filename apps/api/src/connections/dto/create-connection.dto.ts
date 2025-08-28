// Created automatically by Cursor AI (2024-08-27)

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID, IsOptional, IsString } from 'class-validator';
import { ConnectionProvider } from '../entities/connection.entity';

export class CreateConnectionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  householdId: string;

  @ApiProperty({ enum: ConnectionProvider, example: ConnectionProvider.PLAID })
  @IsEnum(ConnectionProvider)
  provider: ConnectionProvider;

  @ApiProperty({ example: 'Chase Bank', required: false })
  @IsOptional()
  @IsString()
  institutionName?: string;

  @ApiProperty({ example: 'chase', required: false })
  @IsOptional()
  @IsString()
  institutionId?: string;
}
