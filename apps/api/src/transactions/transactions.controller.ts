# Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { TransactionsListResponseDto } from './dto/transactions-list-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get transactions with filters and cursor pagination' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully', type: TransactionsListResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of transactions to return (max 100)', type: Number })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor for pagination', type: String })
  @ApiQuery({ name: 'account_id', required: false, description: 'Filter by account ID', type: String })
  @ApiQuery({ name: 'category_id', required: false, description: 'Filter by category ID', type: String })
  @ApiQuery({ name: 'merchant_name', required: false, description: 'Filter by merchant name', type: String })
  @ApiQuery({ name: 'date_from', required: false, description: 'Filter from date (ISO)', type: String })
  @ApiQuery({ name: 'date_to', required: false, description: 'Filter to date (ISO)', type: String })
  @ApiQuery({ name: 'amount_min', required: false, description: 'Minimum amount', type: Number })
  @ApiQuery({ name: 'amount_max', required: false, description: 'Maximum amount', type: Number })
  @ApiQuery({ name: 'is_transfer', required: false, description: 'Filter transfers only', type: Boolean })
  @ApiQuery({ name: 'search', required: false, description: 'Search in description and merchant', type: String })
  async getTransactions(
    @Request() req,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
    @Query('account_id') accountId?: string,
    @Query('category_id') categoryId?: string,
    @Query('merchant_name') merchantName?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('amount_min') amountMin?: number,
    @Query('amount_max') amountMax?: number,
    @Query('is_transfer') isTransfer?: boolean,
    @Query('search') search?: string,
  ): Promise<TransactionsListResponseDto> {
    return this.transactionsService.getTransactions(req.user.id, {
      limit: limit || 50,
      cursor,
      accountId,
      categoryId,
      merchantName,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      amountMin,
      amountMax,
      isTransfer,
      search,
    });
  }

  @Get(':id')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully', type: TransactionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(@Request() req, @Param('id') id: string): Promise<TransactionResponseDto> {
    return this.transactionsService.getTransaction(req.user.id, id);
  }

  @Post()
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Create transaction' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully', type: TransactionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createTransaction(
    @Request() req,
    @Body() createTransactionDto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.createTransaction(req.user.id, createTransactionDto);
  }

  @Put(':id')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Update transaction' })
  @ApiResponse({ status: 200, description: 'Transaction updated successfully', type: TransactionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async updateTransaction(
    @Request() req,
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.updateTransaction(req.user.id, id, updateTransactionDto);
  }

  @Delete(':id')
  @Roles(MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Delete transaction' })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async deleteTransaction(@Request() req, @Param('id') id: string): Promise<void> {
    return this.transactionsService.deleteTransaction(req.user.id, id);
  }

  @Post(':id/categorize')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Categorize transaction' })
  @ApiResponse({ status: 200, description: 'Transaction categorized successfully', type: TransactionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async categorizeTransaction(
    @Request() req,
    @Param('id') id: string,
    @Body('category_id') categoryId: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.categorizeTransaction(req.user.id, id, categoryId);
  }

  @Post('bulk-categorize')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Bulk categorize transactions' })
  @ApiResponse({ status: 200, description: 'Transactions categorized successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async bulkCategorizeTransactions(
    @Request() req,
    @Body() body: { transaction_ids: string[]; category_id: string },
  ): Promise<{ updated_count: number }> {
    return this.transactionsService.bulkCategorizeTransactions(
      req.user.id,
      body.transaction_ids,
      body.category_id,
    );
  }
}
