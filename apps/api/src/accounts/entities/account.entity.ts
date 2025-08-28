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
import { Household } from '../../households/entities/household.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { RecurringTransaction } from '../../transactions/entities/recurring-transaction.entity';

export enum AccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  CREDIT = 'credit',
  INVESTMENT = 'investment',
  LOAN = 'loan',
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  householdId: string;

  @Column()
  connectionId: string;

  @Column()
  externalId: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: AccountType,
    default: AccountType.CHECKING,
  })
  type: AccountType;

  @Column('decimal', { precision: 15, scale: 2 })
  balance: number;

  @Column({ length: 3 })
  currency: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Household, (household) => household.accounts)
  @JoinColumn({ name: 'householdId' })
  household: Household;

  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions: Transaction[];

  @OneToMany(() => RecurringTransaction, (recurringTransaction) => recurringTransaction.account)
  recurringTransactions: RecurringTransaction[];
}
