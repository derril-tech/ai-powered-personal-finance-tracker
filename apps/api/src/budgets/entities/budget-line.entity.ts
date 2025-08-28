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
import { Budget } from './budget.entity';
import { Category } from '../../categories/entities/category.entity';

@Entity('budget_lines')
export class BudgetLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  budgetId: string;

  @Column()
  categoryId: string;

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column({ default: false })
  rollover: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Budget, (budget) => budget.budgetLines)
  @JoinColumn({ name: 'budgetId' })
  budget: Budget;

  @ManyToOne(() => Category, (category) => category.budgetLines)
  @JoinColumn({ name: 'categoryId' })
  category: Category;
}
