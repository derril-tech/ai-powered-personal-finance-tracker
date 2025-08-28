// Created automatically by Cursor AI (2024-12-19)

import { PartialType } from '@nestjs/swagger';
import { CreateBudgetLineDto } from './create-budget-line.dto';

export class UpdateBudgetLineDto extends PartialType(CreateBudgetLineDto) {}
