// Created automatically by Cursor AI (2024-12-19)

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Budget } from '../budgets/entities/budget.entity';
import { BudgetLine } from '../budgets/entities/budget-line.entity';
import { Goal } from '../goals/entities/goal.entity';
import { Anomaly } from '../anomalies/entities/anomaly.entity';
import { RecurringTransaction } from '../transactions/entities/recurring-transaction.entity';
import { Category } from '../categories/entities/category.entity';

export interface DashboardOverview {
  netWorth: {
    current: number;
    change: number;
    changePercent: number;
  };
  upcomingBills: {
    count: number;
    totalAmount: number;
    nextDue: Date | null;
  };
  budgetStatus: {
    totalBudget: number;
    totalSpent: number;
    remaining: number;
    utilizationPercent: number;
  };
  recentAnomalies: {
    count: number;
    unreadCount: number;
  };
  accountBalances: {
    total: number;
    accounts: Array<{
      id: string;
      name: string;
      balance: number;
      currency: string;
    }>;
  };
  goalsProgress: {
    totalGoals: number;
    completedGoals: number;
    totalTarget: number;
    totalSaved: number;
  };
}

export interface NetWorthTrend {
  period: string;
  data: Array<{
    date: string;
    netWorth: number;
    assets: number;
    liabilities: number;
  }>;
  summary: {
    startValue: number;
    endValue: number;
    change: number;
    changePercent: number;
  };
}

export interface UpcomingBill {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: 'upcoming' | 'due_soon' | 'overdue';
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
}

export interface BudgetStatus {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  utilizationPercent: number;
  categories: Array<{
    id: string;
    name: string;
    budget: number;
    spent: number;
    remaining: number;
    utilizationPercent: number;
    status: 'on_track' | 'warning' | 'over_budget';
  }>;
}

export interface SpendingSummary {
  period: string;
  totalSpent: number;
  categories: Array<{
    id: string;
    name: string;
    amount: number;
    percent: number;
    color: string;
  }>;
}

export interface GoalProgress {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  progressPercent: number;
  status: 'on_track' | 'behind' | 'ahead';
  monthlyContribution: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Budget)
    private budgetRepository: Repository<Budget>,
    @InjectRepository(BudgetLine)
    private budgetLineRepository: Repository<BudgetLine>,
    @InjectRepository(Goal)
    private goalRepository: Repository<Goal>,
    @InjectRepository(Anomaly)
    private anomalyRepository: Repository<Anomaly>,
    @InjectRepository(RecurringTransaction)
    private recurringTransactionRepository: Repository<RecurringTransaction>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async getDashboardOverview(userId: string, householdId: string): Promise<DashboardOverview> {
    const [
      netWorth,
      upcomingBills,
      budgetStatus,
      recentAnomalies,
      accountBalances,
      goalsProgress,
    ] = await Promise.all([
      this.getNetWorthSummary(householdId),
      this.getUpcomingBillsSummary(householdId),
      this.getBudgetStatusSummary(householdId),
      this.getRecentAnomaliesSummary(householdId),
      this.getAccountBalancesSummary(householdId),
      this.getGoalsProgressSummary(householdId),
    ]);

    return {
      netWorth,
      upcomingBills,
      budgetStatus,
      recentAnomalies,
      accountBalances,
      goalsProgress,
    };
  }

  async getNetWorthTrend(householdId: string, period: '30d' | '90d' | '1y' | 'all'): Promise<NetWorthTrend> {
    const endDate = new Date();
    let startDate: Date;

    switch (period) {
      case '30d':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    // Get daily net worth data
    const netWorthData = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select([
        'DATE(transaction.date) as date',
        'SUM(transaction.amount) as daily_change',
      ])
      .innerJoin('transaction.account', 'account')
      .where('account.householdId = :householdId', { householdId })
      .andWhere('transaction.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('transaction.is_transfer = false')
      .groupBy('DATE(transaction.date)')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Calculate cumulative net worth
    let runningNetWorth = 0;
    const data = netWorthData.map((row: any) => {
      runningNetWorth += parseFloat(row.daily_change);
      return {
        date: row.date,
        netWorth: runningNetWorth,
        assets: runningNetWorth > 0 ? runningNetWorth : 0,
        liabilities: runningNetWorth < 0 ? Math.abs(runningNetWorth) : 0,
      };
    });

    const startValue = data.length > 0 ? data[0].netWorth : 0;
    const endValue = data.length > 0 ? data[data.length - 1].netWorth : 0;
    const change = endValue - startValue;
    const changePercent = startValue !== 0 ? (change / startValue) * 100 : 0;

    return {
      period,
      data,
      summary: {
        startValue,
        endValue,
        change,
        changePercent,
      },
    };
  }

  async getUpcomingBills(householdId: string, days: number): Promise<UpcomingBill[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const recurringTransactions = await this.recurringTransactionRepository
      .createQueryBuilder('recurring')
      .innerJoin('recurring.account', 'account')
      .innerJoin('recurring.category', 'category')
      .where('account.householdId = :householdId', { householdId })
      .andWhere('recurring.next_due <= :endDate', { endDate })
      .andWhere('recurring.is_active = true')
      .select([
        'recurring.id',
        'recurring.merchant',
        'recurring.amount',
        'recurring.currency',
        'recurring.next_due',
        'account.id',
        'account.name',
        'category.id',
        'category.name',
      ])
      .orderBy('recurring.next_due', 'ASC')
      .getRawMany();

    return recurringTransactions.map((row: any) => {
      const dueDate = new Date(row.next_due);
      const daysUntilDue = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      let status: 'upcoming' | 'due_soon' | 'overdue';
      if (daysUntilDue < 0) {
        status = 'overdue';
      } else if (daysUntilDue <= 7) {
        status = 'due_soon';
      } else {
        status = 'upcoming';
      }

      return {
        id: row.id,
        merchant: row.merchant,
        amount: parseFloat(row.amount),
        currency: row.currency,
        dueDate,
        status,
        accountId: row.account_id,
        accountName: row.account_name,
        categoryId: row.category_id,
        categoryName: row.category_name,
      };
    });
  }

  async getBudgetStatus(householdId: string): Promise<BudgetStatus> {
    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // Get active budget for current month
    const budget = await this.budgetRepository
      .createQueryBuilder('budget')
      .where('budget.householdId = :householdId', { householdId })
      .andWhere('budget.start_date <= :startOfMonth', { startOfMonth })
      .andWhere('budget.end_date >= :endOfMonth', { endOfMonth })
      .andWhere('budget.is_active = true')
      .getOne();

    if (!budget) {
      return {
        totalBudget: 0,
        totalSpent: 0,
        remaining: 0,
        utilizationPercent: 0,
        categories: [],
      };
    }

    // Get budget lines
    const budgetLines = await this.budgetLineRepository
      .createQueryBuilder('budgetLine')
      .innerJoin('budgetLine.category', 'category')
      .where('budgetLine.budgetId = :budgetId', { budgetId: budget.id })
      .select([
        'budgetLine.id',
        'budgetLine.amount',
        'category.id',
        'category.name',
      ])
      .getRawMany();

    // Get spending by category
    const spendingByCategory = await this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin('transaction.account', 'account')
      .innerJoin('transaction.category', 'category')
      .where('account.householdId = :householdId', { householdId })
      .andWhere('transaction.date BETWEEN :startOfMonth AND :endOfMonth', { startOfMonth, endOfMonth })
      .andWhere('transaction.amount < 0') // Only expenses
      .andWhere('transaction.is_transfer = false')
      .select([
        'category.id',
        'SUM(ABS(transaction.amount)) as spent',
      ])
      .groupBy('category.id')
      .getRawMany();

    const spendingMap = new Map();
    spendingByCategory.forEach((row: any) => {
      spendingMap.set(row.category_id, parseFloat(row.spent));
    });

    let totalBudget = 0;
    let totalSpent = 0;

    const categories = budgetLines.map((line: any) => {
      const budget = parseFloat(line.amount);
      const spent = spendingMap.get(line.category_id) || 0;
      const remaining = budget - spent;
      const utilizationPercent = budget > 0 ? (spent / budget) * 100 : 0;

      let status: 'on_track' | 'warning' | 'over_budget';
      if (utilizationPercent >= 100) {
        status = 'over_budget';
      } else if (utilizationPercent >= 80) {
        status = 'warning';
      } else {
        status = 'on_track';
      }

      totalBudget += budget;
      totalSpent += spent;

      return {
        id: line.category_id,
        name: line.category_name,
        budget,
        spent,
        remaining,
        utilizationPercent,
        status,
      };
    });

    const remaining = totalBudget - totalSpent;
    const utilizationPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      totalBudget,
      totalSpent,
      remaining,
      utilizationPercent,
      categories,
    };
  }

  async getRecentAnomalies(householdId: string, limit: number): Promise<any[]> {
    return this.anomalyRepository
      .createQueryBuilder('anomaly')
      .innerJoin('anomaly.transaction', 'transaction')
      .innerJoin('transaction.account', 'account')
      .innerJoin('transaction.category', 'category')
      .where('account.householdId = :householdId', { householdId })
      .andWhere('anomaly.is_resolved = false')
      .select([
        'anomaly.id',
        'anomaly.score',
        'anomaly.reason',
        'anomaly.created_at',
        'anomaly.is_read',
        'transaction.id',
        'transaction.merchant',
        'transaction.amount',
        'transaction.date',
        'category.name',
      ])
      .orderBy('anomaly.created_at', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async getSpendingSummary(householdId: string, period: 'current_month' | 'last_month' | 'last_3_months'): Promise<SpendingSummary> {
    const endDate = new Date();
    let startDate: Date;

    switch (period) {
      case 'current_month':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
        endDate.setMonth(endDate.getMonth() - 1);
        endDate.setDate(0);
        break;
      case 'last_3_months':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 3, 1);
        break;
    }

    const spendingByCategory = await this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin('transaction.account', 'account')
      .innerJoin('transaction.category', 'category')
      .where('account.householdId = :householdId', { householdId })
      .andWhere('transaction.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('transaction.amount < 0') // Only expenses
      .andWhere('transaction.is_transfer = false')
      .select([
        'category.id',
        'category.name',
        'category.color',
        'SUM(ABS(transaction.amount)) as amount',
      ])
      .groupBy('category.id, category.name, category.color')
      .orderBy('amount', 'DESC')
      .getRawMany();

    const totalSpent = spendingByCategory.reduce((sum, row: any) => sum + parseFloat(row.amount), 0);

    const categories = spendingByCategory.map((row: any) => ({
      id: row.category_id,
      name: row.category_name,
      amount: parseFloat(row.amount),
      percent: totalSpent > 0 ? (parseFloat(row.amount) / totalSpent) * 100 : 0,
      color: row.category_color || '#3B82F6',
    }));

    return {
      period,
      totalSpent,
      categories,
    };
  }

  async getAccountBalances(householdId: string): Promise<any> {
    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .where('account.householdId = :householdId', { householdId })
      .andWhere('account.is_active = true')
      .select([
        'account.id',
        'account.name',
        'account.balance',
        'account.currency',
      ])
      .getRawMany();

    const total = accounts.reduce((sum, account: any) => sum + parseFloat(account.balance), 0);

    return {
      total,
      accounts: accounts.map((account: any) => ({
        id: account.account_id,
        name: account.account_name,
        balance: parseFloat(account.balance),
        currency: account.currency,
      })),
    };
  }

  async getGoalsProgress(householdId: string): Promise<GoalProgress[]> {
    const goals = await this.goalRepository
      .createQueryBuilder('goal')
      .where('goal.householdId = :householdId', { householdId })
      .andWhere('goal.is_active = true')
      .select([
        'goal.id',
        'goal.name',
        'goal.target_amount',
        'goal.current_amount',
        'goal.target_date',
        'goal.monthly_contribution',
      ])
      .getRawMany();

    return goals.map((goal: any) => {
      const targetAmount = parseFloat(goal.target_amount);
      const currentAmount = parseFloat(goal.current_amount);
      const progressPercent = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
      const targetDate = new Date(goal.target_date);
      const monthlyContribution = parseFloat(goal.monthly_contribution);

      // Calculate if on track based on time remaining and monthly contribution
      const now = new Date();
      const monthsRemaining = Math.max(0, (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
      const expectedAmount = currentAmount + (monthlyContribution * monthsRemaining);
      
      let status: 'on_track' | 'behind' | 'ahead';
      if (expectedAmount >= targetAmount) {
        status = 'ahead';
      } else if (expectedAmount >= targetAmount * 0.8) {
        status = 'on_track';
      } else {
        status = 'behind';
      }

      return {
        id: goal.goal_id,
        name: goal.goal_name,
        targetAmount,
        currentAmount,
        targetDate,
        progressPercent,
        status,
        monthlyContribution,
      };
    });
  }

  private async getNetWorthSummary(householdId: string) {
    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .where('account.householdId = :householdId', { householdId })
      .andWhere('account.is_active = true')
      .select('SUM(account.balance)', 'total')
      .getRawOne();

    const currentNetWorth = parseFloat(accounts?.total || '0');

    // Get net worth from 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const previousNetWorth = await this.getNetWorthAtDate(householdId, thirtyDaysAgo);
    const change = currentNetWorth - previousNetWorth;
    const changePercent = previousNetWorth !== 0 ? (change / previousNetWorth) * 100 : 0;

    return {
      current: currentNetWorth,
      change,
      changePercent,
    };
  }

  private async getNetWorthAtDate(householdId: string, date: Date): Promise<number> {
    // This is a simplified calculation - in a real implementation,
    // you'd need to calculate net worth at a specific point in time
    // by considering all transactions up to that date
    return 0; // Placeholder
  }

  private async getUpcomingBillsSummary(householdId: string) {
    const bills = await this.getUpcomingBills(householdId, 30);
    
    return {
      count: bills.length,
      totalAmount: bills.reduce((sum, bill) => sum + bill.amount, 0),
      nextDue: bills.length > 0 ? bills[0].dueDate : null,
    };
  }

  private async getBudgetStatusSummary(householdId: string) {
    const budgetStatus = await this.getBudgetStatus(householdId);
    
    return {
      totalBudget: budgetStatus.totalBudget,
      totalSpent: budgetStatus.totalSpent,
      remaining: budgetStatus.remaining,
      utilizationPercent: budgetStatus.utilizationPercent,
    };
  }

  private async getRecentAnomaliesSummary(householdId: string) {
    const anomalies = await this.getRecentAnomalies(householdId, 10);
    const unreadCount = anomalies.filter((a: any) => !a.is_read).length;
    
    return {
      count: anomalies.length,
      unreadCount,
    };
  }

  private async getAccountBalancesSummary(householdId: string) {
    return this.getAccountBalances(householdId);
  }

  private async getGoalsProgressSummary(householdId: string) {
    const goals = await this.getGoalsProgress(householdId);
    
    return {
      totalGoals: goals.length,
      completedGoals: goals.filter(g => g.progressPercent >= 100).length,
      totalTarget: goals.reduce((sum, goal) => sum + goal.targetAmount, 0),
      totalSaved: goals.reduce((sum, goal) => sum + goal.currentAmount, 0),
    };
  }
}
