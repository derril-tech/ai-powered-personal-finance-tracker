// Created automatically by Cursor AI (2024-08-27)

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Household {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Membership {
  id: string;
  userId: string;
  householdId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  householdId: string;
  connectionId: string;
  externalId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'loan';
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  accountId: string;
  externalId: string;
  amount: number;
  currency: string;
  description: string;
  merchantName?: string;
  merchantId?: string;
  categoryId?: string;
  tags: string[];
  date: Date;
  isTransfer: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Merchant {
  id: string;
  name: string;
  website?: string;
  country?: string;
  mcc?: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Budget {
  id: string;
  householdId: string;
  name: string;
  period: 'monthly' | 'yearly';
  startDate: Date;
  buffer: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetLine {
  id: string;
  budgetId: string;
  categoryId: string;
  amount: number;
  rollover: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Goal {
  id: string;
  householdId: string;
  name: string;
  targetAmount: number;
  targetDate: Date;
  accountId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringTransaction {
  id: string;
  householdId: string;
  description: string;
  amount: number;
  currency: string;
  cadence: string;
  nextDue: Date;
  lastSeen: Date;
  status: 'active' | 'paused' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface Forecast {
  id: string;
  householdId: string;
  categoryId?: string;
  accountId?: string;
  date: Date;
  p50: number;
  p90: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Anomaly {
  id: string;
  householdId: string;
  transactionId: string;
  score: number;
  reason: string;
  verdict?: 'legitimate' | 'fraud';
  createdAt: Date;
  updatedAt: Date;
}
