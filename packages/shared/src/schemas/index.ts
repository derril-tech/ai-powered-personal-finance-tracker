// Created automatically by Cursor AI (2024-08-27)

import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const HouseholdSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  organizationId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const MembershipSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  householdId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const AccountSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  connectionId: z.string().uuid(),
  externalId: z.string(),
  name: z.string().min(1),
  type: z.enum(['checking', 'savings', 'credit', 'investment', 'loan']),
  balance: z.number(),
  currency: z.string().length(3),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  externalId: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  description: z.string(),
  merchantName: z.string().optional(),
  merchantId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string()),
  date: z.date(),
  isTransfer: z.boolean(),
  metadata: z.record(z.any()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const MerchantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  website: z.string().url().optional(),
  country: z.string().length(2).optional(),
  mcc: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  parentId: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  icon: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const BudgetSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string().min(1),
  period: z.enum(['monthly', 'yearly']),
  startDate: z.date(),
  buffer: z.number().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const BudgetLineSchema = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: z.number().min(0),
  rollover: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const GoalSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  targetDate: z.date(),
  accountId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const RecurringTransactionSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  description: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  cadence: z.string(),
  nextDue: z.date(),
  lastSeen: z.date(),
  status: z.enum(['active', 'paused', 'cancelled']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ForecastSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  date: z.date(),
  p50: z.number(),
  p90: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const AnomalySchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  transactionId: z.string().uuid(),
  score: z.number().min(0).max(1),
  reason: z.string(),
  verdict: z.enum(['legitimate', 'fraud']).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
