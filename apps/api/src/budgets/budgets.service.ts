// Created automatically by Cursor AI (2024-12-19)

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Budget, BudgetPeriod } from './entities/budget.entity';
import { BudgetLine } from './entities/budget-line.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { Membership, MembershipRole } from '../households/entities/membership.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { BudgetResponseDto, BudgetLineResponseDto } from './dto/budget-response.dto';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(BudgetLine)
    private readonly budgetLineRepository: Repository<BudgetLine>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}

  async createBudget(householdId: string, createBudgetDto: CreateBudgetDto): Promise<BudgetResponseDto> {
    const budget = this.budgetRepository.create({
      ...createBudgetDto,
      householdId,
      startDate: new Date(createBudgetDto.startDate),
      buffer: createBudgetDto.buffer || 0,
      visibleAccountIds: createBudgetDto.visibleAccountIds || [],
      isShared: createBudgetDto.isShared !== undefined ? createBudgetDto.isShared : true,
    });

    const savedBudget = await this.budgetRepository.save(budget);
    return this.getBudgetWithDetails(savedBudget.id);
  }

  async getBudgets(householdId: string, userId: string): Promise<BudgetResponseDto[]> {
    // Get user's membership role
    const membership = await this.membershipRepository.findOne({
      where: { householdId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this household');
    }

    // Get all budgets for the household
    const budgets = await this.budgetRepository.find({
      where: { householdId },
      relations: ['budgetLines', 'budgetLines.category'],
      order: { createdAt: 'DESC' },
    });

    // Filter budgets based on user role and budget sharing settings
    const accessibleBudgets = budgets.filter(budget => {
      // Owners and admins can see all budgets
      if (membership.role === MembershipRole.OWNER || membership.role === MembershipRole.ADMIN) {
        return true;
      }
      
      // Members and viewers can only see shared budgets
      return budget.isShared;
    });

    return Promise.all(accessibleBudgets.map(budget => this.calculateBudgetDetails(budget)));
  }

  async getBudget(id: string, userId: string): Promise<BudgetResponseDto> {
    const budget = await this.budgetRepository.findOne({
      where: { id },
      relations: ['budgetLines', 'budgetLines.category'],
    });

    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found`);
    }

    // Check user access
    await this.checkBudgetAccess(budget, userId);

    return this.calculateBudgetDetails(budget);
  }

  async updateBudget(id: string, updateBudgetDto: UpdateBudgetDto, userId: string): Promise<BudgetResponseDto> {
    const budget = await this.budgetRepository.findOne({ where: { id } });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found`);
    }

    // Check user access and permissions
    await this.checkBudgetAccess(budget, userId, true);

    if (updateBudgetDto.startDate) {
      budget.startDate = new Date(updateBudgetDto.startDate);
    }

    Object.assign(budget, updateBudgetDto);
    await this.budgetRepository.save(budget);

    return this.getBudgetWithDetails(id);
  }

  async deleteBudget(id: string, userId: string): Promise<void> {
    const budget = await this.budgetRepository.findOne({ where: { id } });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found`);
    }

    // Check user access and permissions
    await this.checkBudgetAccess(budget, userId, true);

    // Delete budget lines first
    await this.budgetLineRepository.delete({ budgetId: id });
    
    // Delete budget
    await this.budgetRepository.remove(budget);
  }

  async createBudgetLine(budgetId: string, createBudgetLineDto: CreateBudgetLineDto): Promise<BudgetLineResponseDto> {
    const budget = await this.budgetRepository.findOne({ where: { id: budgetId } });
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${budgetId} not found`);
    }

    // Check if budget line already exists for this category
    const existingLine = await this.budgetLineRepository.findOne({
      where: { budgetId, categoryId: createBudgetLineDto.categoryId },
    });

    if (existingLine) {
      throw new BadRequestException(`Budget line already exists for category ${createBudgetLineDto.categoryId}`);
    }

    const budgetLine = this.budgetLineRepository.create({
      ...createBudgetLineDto,
      budgetId,
      rollover: createBudgetLineDto.rollover || false,
    });

    const savedLine = await this.budgetLineRepository.save(budgetLine);
    return this.calculateBudgetLineDetails(savedLine);
  }

  async updateBudgetLine(id: string, updateBudgetLineDto: UpdateBudgetLineDto): Promise<BudgetLineResponseDto> {
    const budgetLine = await this.budgetLineRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!budgetLine) {
      throw new NotFoundException(`Budget line with ID ${id} not found`);
    }

    Object.assign(budgetLine, updateBudgetLineDto);
    const savedLine = await this.budgetLineRepository.save(budgetLine);
    return this.calculateBudgetLineDetails(savedLine);
  }

  async deleteBudgetLine(id: string): Promise<void> {
    const budgetLine = await this.budgetLineRepository.findOne({ where: { id } });
    if (!budgetLine) {
      throw new NotFoundException(`Budget line with ID ${id} not found`);
    }

    await this.budgetLineRepository.remove(budgetLine);
  }

  private async checkBudgetAccess(budget: Budget, userId: string, requireWrite = false): Promise<void> {
    // Get user's membership role
    const membership = await this.membershipRepository.findOne({
      where: { householdId: budget.householdId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this household');
    }

    // Check if user can access this budget
    if (membership.role === MembershipRole.OWNER || membership.role === MembershipRole.ADMIN) {
      return; // Owners and admins have full access
    }

    // Members and viewers can only access shared budgets
    if (!budget.isShared) {
      throw new ForbiddenException('Access denied to private budget');
    }

    // Only owners and admins can modify budgets
    if (requireWrite && membership.role !== MembershipRole.OWNER && membership.role !== MembershipRole.ADMIN) {
      throw new ForbiddenException('Insufficient permissions to modify budget');
    }
  }

  private async getBudgetWithDetails(id: string): Promise<BudgetResponseDto> {
    const budget = await this.budgetRepository.findOne({
      where: { id },
      relations: ['budgetLines', 'budgetLines.category'],
    });

    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found`);
    }

    return this.calculateBudgetDetails(budget);
  }

  private async calculateBudgetDetails(budget: Budget): Promise<BudgetResponseDto> {
    const budgetLines = await Promise.all(
      budget.budgetLines.map(line => this.calculateBudgetLineDetails(line))
    );

    const totalBudget = budgetLines.reduce((sum, line) => sum + line.amount, 0);
    const totalSpent = budgetLines.reduce((sum, line) => sum + line.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const safeToSpend = Math.max(0, totalRemaining - budget.buffer);
    const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      id: budget.id,
      householdId: budget.householdId,
      name: budget.name,
      period: budget.period,
      startDate: budget.startDate,
      buffer: budget.buffer,
      visibleAccountIds: budget.visibleAccountIds || [],
      isShared: budget.isShared,
      totalBudget,
      totalSpent,
      totalRemaining,
      safeToSpend,
      percentageUsed,
      budgetLines,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }

  private async calculateBudgetLineDetails(budgetLine: BudgetLine): Promise<BudgetLineResponseDto> {
    // Get the current budget period dates
    const budget = await this.budgetRepository.findOne({ where: { id: budgetLine.budgetId } });
    if (!budget) {
      throw new NotFoundException(`Budget not found for budget line ${budgetLine.id}`);
    }

    const { startDate, endDate } = this.getCurrentPeriodDates(budget);
    
    // Calculate spent amount for this category in the current period
    const spent = await this.calculateSpentAmount(budget.householdId, budgetLine.categoryId, startDate, endDate, budget.visibleAccountIds);
    
    const remaining = Math.max(0, budgetLine.amount - spent);
    const percentageUsed = budgetLine.amount > 0 ? (spent / budgetLine.amount) * 100 : 0;

    return {
      id: budgetLine.id,
      categoryId: budgetLine.categoryId,
      categoryName: budgetLine.category?.name || 'Unknown Category',
      amount: budgetLine.amount,
      spent,
      remaining,
      percentageUsed,
      rollover: budgetLine.rollover,
      createdAt: budgetLine.createdAt,
      updatedAt: budgetLine.updatedAt,
    };
  }

  private getCurrentPeriodDates(budget: Budget): { startDate: Date; endDate: Date } {
    const now = new Date();
    const budgetStart = new Date(budget.startDate);
    
    if (budget.period === BudgetPeriod.MONTHLY) {
      // Calculate current month period
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      return {
        startDate: currentMonth,
        endDate: nextMonth,
      };
    } else {
      // Calculate current year period
      const currentYear = new Date(now.getFullYear(), 0, 1);
      const nextYear = new Date(now.getFullYear() + 1, 0, 1);
      
      return {
        startDate: currentYear,
        endDate: nextYear,
      };
    }
  }

  private async calculateSpentAmount(householdId: string, categoryId: string, startDate: Date, endDate: Date, visibleAccountIds?: string[]): Promise<number> {
    // Get accounts for the household, filtered by visibility if specified
    let accountQuery = this.accountRepository.createQueryBuilder('account')
      .where('account.householdId = :householdId', { householdId })
      .andWhere('account.isActive = :isActive', { isActive: true });

    if (visibleAccountIds && visibleAccountIds.length > 0) {
      accountQuery = accountQuery.andWhere('account.id IN (:...visibleAccountIds)', { visibleAccountIds });
    }

    const accounts = await accountQuery.select(['account.id']).getMany();

    if (accounts.length === 0) {
      return 0;
    }

    const accountIds = accounts.map(account => account.id);

    // Query transactions for the category in the given period
    // Only include non-transfer transactions with negative amounts (expenses)
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(ABS(transaction.amount)), 0)', 'totalSpent')
      .where('transaction.accountId IN (:...accountIds)', { accountIds })
      .andWhere('transaction.categoryId = :categoryId', { categoryId })
      .andWhere('transaction.date >= :startDate', { startDate })
      .andWhere('transaction.date < :endDate', { endDate })
      .andWhere('transaction.isTransfer = :isTransfer', { isTransfer: false })
      .andWhere('transaction.amount < 0') // Only expenses
      .getRawOne();

    return parseFloat(result.totalSpent) || 0;
  }
}
