// Created automatically by Cursor AI (2024-12-19)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Account } from '../accounts/entities/account.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Budget } from '../budgets/entities/budget.entity';
import { BudgetLine } from '../budgets/entities/budget-line.entity';
import { Goal } from '../goals/entities/goal.entity';
import { Anomaly } from '../anomalies/entities/anomaly.entity';
import { RecurringTransaction } from '../transactions/entities/recurring-transaction.entity';
import { Category } from '../categories/entities/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      Transaction,
      Budget,
      BudgetLine,
      Goal,
      Anomaly,
      RecurringTransaction,
      Category,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
