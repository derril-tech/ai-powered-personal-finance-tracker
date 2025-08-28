// Created automatically by Cursor AI (2024-08-27)

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Household } from '../../households/entities/household.entity';
import { Account } from '../../accounts/entities/account.entity';

@Entity('goals')
export class Goal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  householdId: string;

  @Column()
  name: string;

  @Column('decimal', { precision: 15, scale: 2 })
  targetAmount: number;

  @Column()
  targetDate: Date;

  @Column()
  accountId: string;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  currentAmount: number;

  @Column('decimal', { precision: 15, scale: 2, nullable: true })
  monthlyContribution: number;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Household, (household) => household.goals)
  @JoinColumn({ name: 'householdId' })
  household: Household;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'accountId' })
  account: Account;
}
