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
import { BudgetLine } from './budget-line.entity';

export enum BudgetPeriod {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  householdId: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: BudgetPeriod,
    default: BudgetPeriod.MONTHLY,
  })
  period: BudgetPeriod;

  @Column()
  startDate: Date;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  buffer: number;

  @Column('simple-array', { nullable: true })
  visibleAccountIds: string[];

  @Column({ default: true })
  isShared: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Household, (household) => household.budgets)
  @JoinColumn({ name: 'householdId' })
  household: Household;

  @OneToMany(() => BudgetLine, (budgetLine) => budgetLine.budget)
  budgetLines: BudgetLine[];
}
