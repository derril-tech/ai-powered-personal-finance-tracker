// Created automatically by Cursor AI (2024-08-27)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { RecurringTransaction } from './entities/recurring-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, RecurringTransaction])],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
