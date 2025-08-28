// Created automatically by Cursor AI (2024-12-19)

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { BudgetResponseDto, BudgetLineResponseDto } from './dto/budget-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new budget' })
  @ApiResponse({ status: 201, description: 'Budget created successfully', type: BudgetResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createBudget(
    @Request() req,
    @Body() createBudgetDto: CreateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.createBudget(req.user.householdId, createBudgetDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all budgets for the household' })
  @ApiResponse({ status: 200, description: 'Budgets retrieved successfully', type: [BudgetResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getBudgets(@Request() req): Promise<BudgetResponseDto[]> {
    return this.budgetsService.getBudgets(req.user.householdId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific budget by ID' })
  @ApiResponse({ status: 200, description: 'Budget retrieved successfully', type: BudgetResponseDto })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getBudget(@Param('id') id: string, @Request() req): Promise<BudgetResponseDto> {
    return this.budgetsService.getBudget(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a budget' })
  @ApiResponse({ status: 200, description: 'Budget updated successfully', type: BudgetResponseDto })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateBudget(
    @Param('id') id: string,
    @Body() updateBudgetDto: UpdateBudgetDto,
    @Request() req,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.updateBudget(id, updateBudgetDto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiResponse({ status: 204, description: 'Budget deleted successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteBudget(@Param('id') id: string, @Request() req): Promise<void> {
    return this.budgetsService.deleteBudget(id, req.user.id);
  }

  @Post(':budgetId/lines')
  @ApiOperation({ summary: 'Create a new budget line' })
  @ApiResponse({ status: 201, description: 'Budget line created successfully', type: BudgetLineResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createBudgetLine(
    @Param('budgetId') budgetId: string,
    @Body() createBudgetLineDto: CreateBudgetLineDto,
  ): Promise<BudgetLineResponseDto> {
    return this.budgetsService.createBudgetLine(budgetId, createBudgetLineDto);
  }

  @Patch('lines/:id')
  @ApiOperation({ summary: 'Update a budget line' })
  @ApiResponse({ status: 200, description: 'Budget line updated successfully', type: BudgetLineResponseDto })
  @ApiResponse({ status: 404, description: 'Budget line not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateBudgetLine(
    @Param('id') id: string,
    @Body() updateBudgetLineDto: UpdateBudgetLineDto,
  ): Promise<BudgetLineResponseDto> {
    return this.budgetsService.updateBudgetLine(id, updateBudgetLineDto);
  }

  @Delete('lines/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a budget line' })
  @ApiResponse({ status: 204, description: 'Budget line deleted successfully' })
  @ApiResponse({ status: 404, description: 'Budget line not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteBudgetLine(@Param('id') id: string): Promise<void> {
    return this.budgetsService.deleteBudgetLine(id);
  }
}
