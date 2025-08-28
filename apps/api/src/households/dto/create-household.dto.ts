// Created automatically by Cursor AI (2024-08-27)

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateHouseholdDto {
  @ApiProperty({ example: 'Smith Family' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  organizationId: string;
}
