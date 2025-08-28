// Created automatically by Cursor AI (2024-08-27)

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('merchants')
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  website: string;

  @Column({ length: 2, nullable: true })
  country: string;

  @Column({ nullable: true })
  mcc: string;

  @Column('vector', { dimension: 384, nullable: true })
  embedding: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Transaction, (transaction) => transaction.merchant)
  transactions: Transaction[];
}
