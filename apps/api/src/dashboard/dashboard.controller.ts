// Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get dashboard overview data' })
  @ApiResponse({ status: 200, description: 'Dashboard overview retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDashboardOverview(@Request() req) {
    const userId = req.user.id;
    const householdId = req.user.householdId;
    
    return this.dashboardService.getDashboardOverview(userId, householdId);
  }

  @Get('net-worth')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get net worth trend data' })
  @ApiResponse({ status: 200, description: 'Net worth trend retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'period', required: false, description: 'Period for trend (30d, 90d, 1y, all)', default: '90d' })
  async getNetWorthTrend(
    @Request() req,
    @Query('period') period: '30d' | '90d' | '1y' | 'all' = '90d',
  ) {
    const householdId = req.user.householdId;
    
    return this.dashboardService.getNetWorthTrend(householdId, period);
  }

  @Get('upcoming-bills')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get upcoming bills' })
  @ApiResponse({ status: 200, description: 'Upcoming bills retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to look ahead', type: Number, default: 30 })
  async getUpcomingBills(
    @Request() req,
    @Query('days') days: number = 30,
  ) {
    const householdId = req.user.householdId;
    
    return this.dashboardService.getUpcomingBills(householdId, days);
  }

  @Get('budget-status')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get current budget status' })
  @ApiResponse({ status: 200, description: 'Budget status retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getBudgetStatus(@Request() req) {
    const householdId = req.user.householdId;
    
    return this.dashboardService.getBudgetStatus(householdId);
  }

  @Get('recent-anomalies')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get recent anomalies' })
  @ApiResponse({ status: 200, description: 'Recent anomalies retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of anomalies to return', type: Number, default: 10 })
  async getRecentAnomalies(
    @Request() req,
    @Query('limit') limit: number = 10,
  ) {
    const householdId = req.user.householdId;
    
    return this.dashboardService.getRecentAnomalies(householdId, limit);
  }

  @Get('spending-summary')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get spending summary by category' })
  @ApiResponse({ status: 200, description: 'Spending summary retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'period', required: false, description: 'Period for summary (current_month, last_month, last_3_months)', default: 'current_month' })
  async getSpendingSummary(
    @Request() req,
    @Query('period') period: 'current_month' | 'last_month' | 'last_3_months' = 'current_month',
  ) {
    const householdId = req.user.householdId;
    
    return this.dashboardService.getSpendingSummary(householdId, period);
  }

  @Get('account-balances')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get current account balances' })
  @ApiResponse({ status: 200, description: 'Account balances retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAccountBalances(@Request() req) {
    const householdId = req.user.householdId;
    
    return this.dashboardService.getAccountBalances(householdId);
  }

  @Get('goals-progress')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get goals progress' })
  @ApiResponse({ status: 200, description: 'Goals progress retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getGoalsProgress(@Request() req) {
    const householdId = req.user.householdId;
    
    return this.dashboardService.getGoalsProgress(householdId);
  }
}
