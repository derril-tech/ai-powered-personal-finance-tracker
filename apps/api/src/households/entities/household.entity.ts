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
import { Organization } from '../../organizations/entities/organization.entity';
import { Membership } from './membership.entity';
import { Account } from '../../accounts/entities/account.entity';
import { Budget } from '../../budgets/entities/budget.entity';
import { Goal } from '../../goals/entities/goal.entity';

@Entity('households')
export class Household {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  organizationId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Organization, (organization) => organization.households)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => Membership, (membership) => membership.household)
  memberships: Membership[];

  @OneToMany(() => Account, (account) => account.household)
  accounts: Account[];

  @OneToMany(() => Budget, (budget) => budget.household)
  budgets: Budget[];

  @OneToMany(() => Goal, (goal) => goal.household)
  goals: Goal[];
}
