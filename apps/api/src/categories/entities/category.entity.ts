// Created automatically by Cursor AI (2024-08-27)

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { BudgetLine } from '../../budgets/entities/budget-line.entity';
import { RecurringTransaction } from '../../transactions/entities/recurring-transaction.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  parentId: string;

  @Column()
  color: string;

  @Column()
  icon: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Category, (category) => category.children)
  @JoinColumn({ name: 'parentId' })
  parent: Category;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @OneToMany(() => Transaction, (transaction) => transaction.category)
  transactions: Transaction[];

  @OneToMany(() => BudgetLine, (budgetLine) => budgetLine.category)
  budgetLines: BudgetLine[];

  @OneToMany(() => RecurringTransaction, (recurringTransaction) => recurringTransaction.category)
  recurringTransactions: RecurringTransaction[];
}
