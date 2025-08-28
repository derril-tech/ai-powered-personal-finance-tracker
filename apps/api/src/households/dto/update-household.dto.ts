// Created automatically by Cursor AI (2024-08-27)

import { PartialType } from '@nestjs/swagger';
import { CreateHouseholdDto } from './create-household.dto';

export class UpdateHouseholdDto extends PartialType(CreateHouseholdDto) {}
