# Created automatically by Cursor AI (2024-12-19)

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { Category } from '../categories/entities/category.entity';
import { Membership } from '../households/entities/membership.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { TransactionsListResponseDto } from './dto/transactions-list-response.dto';

export interface TransactionFilters {
  limit?: number;
  cursor?: string;
  accountId?: string;
  categoryId?: string;
  merchantName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  isTransfer?: boolean;
  search?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Membership)
    private membershipRepository: Repository<Membership>,
  ) {}

  async getTransactions(userId: string, filters: TransactionFilters): Promise<TransactionsListResponseDto> {
    // Check user access to household
    const membership = await this.membershipRepository.findOne({
      where: { user: { id: userId } },
      relations: ['household'],
    });

    if (!membership) {
      throw new ForbiddenException('User not found in any household');
    }

    const householdId = membership.household.id;

    // Build query
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.account', 'account')
      .leftJoinAndSelect('transaction.category', 'category')
      .where('account.household_id = :householdId', { householdId });

    // Apply filters
    this.applyFilters(queryBuilder, filters);

    // Apply cursor pagination
    if (filters.cursor) {
      const decodedCursor = this.decodeCursor(filters.cursor);
      queryBuilder.andWhere('transaction.date < :cursorDate OR (transaction.date = :cursorDate AND transaction.id < :cursorId)', {
        cursorDate: decodedCursor.date,
        cursorId: decodedCursor.id,
      });
    }

    // Get total count
    const countQueryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.account', 'account')
      .where('account.household_id = :householdId', { householdId });

    this.applyFilters(countQueryBuilder, filters);
    const totalCount = await countQueryBuilder.getCount();

    // Get transactions
    const limit = Math.min(filters.limit || 50, 100);
    const transactions = await queryBuilder
      .orderBy('transaction.date', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .limit(limit + 1) // Get one extra to check if there are more
      .getMany();

    const hasMore = transactions.length > limit;
    const resultTransactions = hasMore ? transactions.slice(0, limit) : transactions;

    // Generate cursors
    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (hasMore && resultTransactions.length > 0) {
      const lastTransaction = resultTransactions[resultTransactions.length - 1];
      nextCursor = this.encodeCursor(lastTransaction.date, lastTransaction.id);
    }

    if (filters.cursor && resultTransactions.length > 0) {
      const firstTransaction = resultTransactions[0];
      prevCursor = this.encodeCursor(firstTransaction.date, firstTransaction.id);
    }

    return {
      transactions: resultTransactions.map(this.mapToResponseDto),
      next_cursor: nextCursor,
      prev_cursor: prevCursor,
      total_count: totalCount,
      has_more: hasMore,
    };
  }

  async getTransaction(userId: string, id: string): Promise<TransactionResponseDto> {
    const transaction = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.account', 'account')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoin('account.household', 'household')
      .leftJoin('household.memberships', 'membership')
      .where('transaction.id = :id', { id })
      .andWhere('membership.user_id = :userId', { userId })
      .getOne();

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return this.mapToResponseDto(transaction);
  }

  async createTransaction(userId: string, createTransactionDto: CreateTransactionDto): Promise<TransactionResponseDto> {
    // Check user access to account
    const account = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoin('account.household', 'household')
      .leftJoin('household.memberships', 'membership')
      .where('account.id = :accountId', { accountId: createTransactionDto.account_id })
      .andWhere('membership.user_id = :userId', { userId })
      .getOne();

    if (!account) {
      throw new ForbiddenException('Access denied to account');
    }

    // Check category access if provided
    if (createTransactionDto.category_id) {
      const category = await this.categoryRepository
        .createQueryBuilder('category')
        .leftJoin('category.household', 'household')
        .leftJoin('household.memberships', 'membership')
        .where('category.id = :categoryId', { categoryId: createTransactionDto.category_id })
        .andWhere('(membership.user_id = :userId OR category.household_id IS NULL)', { userId })
        .getOne();

      if (!category) {
        throw new ForbiddenException('Access denied to category');
      }
    }

    const transaction = this.transactionRepository.create({
      ...createTransactionDto,
      date: new Date(createTransactionDto.date),
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    return this.getTransaction(userId, savedTransaction.id);
  }

  async updateTransaction(userId: string, id: string, updateTransactionDto: UpdateTransactionDto): Promise<TransactionResponseDto> {
    const transaction = await this.getTransaction(userId, id);

    // Check account access if changing account
    if (updateTransactionDto.account_id && updateTransactionDto.account_id !== transaction.account_id) {
      const account = await this.accountRepository
        .createQueryBuilder('account')
        .leftJoin('account.household', 'household')
        .leftJoin('household.memberships', 'membership')
        .where('account.id = :accountId', { accountId: updateTransactionDto.account_id })
        .andWhere('membership.user_id = :userId', { userId })
        .getOne();

      if (!account) {
        throw new ForbiddenException('Access denied to account');
      }
    }

    // Check category access if changing category
    if (updateTransactionDto.category_id && updateTransactionDto.category_id !== transaction.category_id) {
      const category = await this.categoryRepository
        .createQueryBuilder('category')
        .leftJoin('category.household', 'household')
        .leftJoin('household.memberships', 'membership')
        .where('category.id = :categoryId', { categoryId: updateTransactionDto.category_id })
        .andWhere('(membership.user_id = :userId OR category.household_id IS NULL)', { userId })
        .getOne();

      if (!category) {
        throw new ForbiddenException('Access denied to category');
      }
    }

    const updateData: any = { ...updateTransactionDto };
    if (updateTransactionDto.date) {
      updateData.date = new Date(updateTransactionDto.date);
    }

    await this.transactionRepository.update(id, updateData);
    return this.getTransaction(userId, id);
  }

  async deleteTransaction(userId: string, id: string): Promise<void> {
    await this.getTransaction(userId, id); // This will throw if not found or no access
    await this.transactionRepository.delete(id);
  }

  async categorizeTransaction(userId: string, id: string, categoryId: string): Promise<TransactionResponseDto> {
    // Check category access
    const category = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.household', 'household')
      .leftJoin('household.memberships', 'membership')
      .where('category.id = :categoryId', { categoryId })
      .andWhere('(membership.user_id = :userId OR category.household_id IS NULL)', { userId })
      .getOne();

    if (!category) {
      throw new ForbiddenException('Access denied to category');
    }

    await this.transactionRepository.update(id, { category_id: categoryId });
    return this.getTransaction(userId, id);
  }

  async bulkCategorizeTransactions(userId: string, transactionIds: string[], categoryId: string): Promise<{ updated_count: number }> {
    // Check category access
    const category = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.household', 'household')
      .leftJoin('household.memberships', 'membership')
      .where('category.id = :categoryId', { categoryId })
      .andWhere('(membership.user_id = :userId OR category.household_id IS NULL)', { userId })
      .getOne();

    if (!category) {
      throw new ForbiddenException('Access denied to category');
    }

    // Check access to all transactions
    const accessibleTransactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.account', 'account')
      .leftJoin('account.household', 'household')
      .leftJoin('household.memberships', 'membership')
      .where('transaction.id IN (:...transactionIds)', { transactionIds })
      .andWhere('membership.user_id = :userId', { userId })
      .getMany();

    if (accessibleTransactions.length !== transactionIds.length) {
      throw new ForbiddenException('Access denied to some transactions');
    }

    const result = await this.transactionRepository
      .createQueryBuilder()
      .update(Transaction)
      .set({ category_id: categoryId })
      .whereInIds(transactionIds)
      .execute();

    return { updated_count: result.affected || 0 };
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Transaction>, filters: TransactionFilters): void {
    if (filters.accountId) {
      queryBuilder.andWhere('account.id = :accountId', { accountId: filters.accountId });
    }

    if (filters.categoryId) {
      queryBuilder.andWhere('category.id = :categoryId', { categoryId: filters.categoryId });
    }

    if (filters.merchantName) {
      queryBuilder.andWhere('transaction.merchant_name ILIKE :merchantName', {
        merchantName: `%${filters.merchantName}%`,
      });
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('transaction.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      queryBuilder.andWhere('transaction.date <= :dateTo', { dateTo: filters.dateTo });
    }

    if (filters.amountMin !== undefined) {
      queryBuilder.andWhere('transaction.amount >= :amountMin', { amountMin: filters.amountMin });
    }

    if (filters.amountMax !== undefined) {
      queryBuilder.andWhere('transaction.amount <= :amountMax', { amountMax: filters.amountMax });
    }

    if (filters.isTransfer !== undefined) {
      queryBuilder.andWhere('transaction.is_transfer = :isTransfer', { isTransfer: filters.isTransfer });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(transaction.description ILIKE :search OR transaction.merchant_name ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }
  }

  private encodeCursor(date: Date, id: string): string {
    const cursorData = { date: date.toISOString(), id };
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  private decodeCursor(cursor: string): { date: string; id: string } {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString();
      return JSON.parse(decoded);
    } catch {
      throw new Error('Invalid cursor');
    }
  }

  private mapToResponseDto(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      date: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
      merchant_name: transaction.merchant_name,
      account_id: transaction.account.id,
      account_name: transaction.account.name,
      category_id: transaction.category?.id,
      category_name: transaction.category?.name,
      is_transfer: transaction.is_transfer,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    };
  }
}
