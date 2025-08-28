// Created automatically by Cursor AI (2024-12-19)

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Category } from '../../categories/entities/category.entity';

@Entity('recurring_transactions')
@Index(['accountId', 'merchant'])
@Index(['next_due'])
export class RecurringTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string;

  @Column()
  merchant: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'descriptor', nullable: true })
  descriptor: string;

  @Column({ name: 'cadence_type' })
  cadenceType: 'daily' | 'weekly' | 'monthly' | 'yearly';

  @Column({ name: 'cadence_value', type: 'int' })
  cadenceValue: number; // e.g., 1 for monthly, 2 for bi-monthly

  @Column({ name: 'next_due', type: 'date' })
  nextDue: Date;

  @Column({ name: 'last_occurrence', type: 'date', nullable: true })
  lastOccurrence: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 3, scale: 2, default: 0.8 })
  confidenceScore: number;

  @Column({ name: 'price_hike_detected', default: false })
  priceHikeDetected: boolean;

  @Column({ name: 'missed_payment', default: false })
  missedPayment: boolean;

  @Column({ name: 'risk_score', type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  riskScore: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Additional data like payment method, notes, etc.

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Account, account => account.recurringTransactions)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @ManyToOne(() => Category, category => category.recurringTransactions)
  @JoinColumn({ name: 'category_id' })
  category: Category;
}
