// Created automatically by Cursor AI (2024-08-27)

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Category } from '../../categories/entities/category.entity';

@Entity('transactions')
@Index(['date', 'id']) // TimescaleDB hypertable index
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  accountId: string;

  @Column()
  externalId: string;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column({ length: 3 })
  currency: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  merchantName: string;

  @Column({ nullable: true })
  merchantId: string;

  @Column({ nullable: true })
  categoryId: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column()
  date: Date;

  @Column({ default: false })
  isTransfer: boolean;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Account, (account) => account.transactions)
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @ManyToOne(() => Merchant)
  @JoinColumn({ name: 'merchantId' })
  merchant: Merchant;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category: Category;
}
