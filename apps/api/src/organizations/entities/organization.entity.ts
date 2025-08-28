// Created automatically by Cursor AI (2024-12-19)

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Household } from '../../households/entities/household.entity';

export interface PlanLimits {
  apiCalls: number; // Monthly API call limit
  imports: number; // Monthly import limit
  exports: number; // Monthly export limit
  storage: number; // Storage limit in GB
  connectors: number; // Number of bank connectors
  reports: number; // Monthly report generation limit
  forecasts: number; // Monthly forecast limit
  anomalyChecks: number; // Monthly anomaly check limit
}

export interface BillingInfo {
  plan: string; // 'free', 'basic', 'pro', 'enterprise'
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: Date;
  amount: number;
  currency: string;
  status: 'active' | 'past_due' | 'cancelled' | 'trial';
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'plan_limits', type: 'jsonb', nullable: true })
  planLimits: PlanLimits;

  @Column({ name: 'billing_info', type: 'jsonb', nullable: true })
  billingInfo: BillingInfo;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => User, user => user.organization)
  users: User[];

  @OneToMany(() => Household, household => household.organization)
  households: Household[];
}
