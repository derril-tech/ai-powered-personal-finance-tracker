// Created automatically by Cursor AI (2024-12-19)

import { PartialType } from '@nestjs/swagger';
import { CreateBudgetDto } from './create-budget.dto';

export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {}
