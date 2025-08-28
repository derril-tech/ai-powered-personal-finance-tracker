// Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MembershipRole } from '../../households/entities/membership.entity';

@ApiTags('usage')
@Controller('usage')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsageController {
  constructor(private readonly usageTrackingService: UsageTrackingService) {}

  @Get('summary')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get usage summary for organization' })
  @ApiResponse({ status: 200, description: 'Usage summary retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'period', required: false, description: 'Period for summary (daily, weekly, monthly)', enum: ['daily', 'weekly', 'monthly'], default: 'monthly' })
  async getUsageSummary(
    @Request() req,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'monthly',
  ) {
    const organizationId = req.user.organizationId;
    return this.usageTrackingService.getUsageSummary(organizationId, period);
  }

  @Get('current')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get current usage for organization' })
  @ApiResponse({ status: 200, description: 'Current usage retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCurrentUsage(@Request() req) {
    const organizationId = req.user.organizationId;
    return this.usageTrackingService.getCurrentUsage(organizationId);
  }

  @Get('trends')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get usage trends over time' })
  @ApiResponse({ status: 200, description: 'Usage trends retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to look back', type: Number, default: 30 })
  async getUsageTrends(
    @Request() req,
    @Query('days') days: number = 30,
  ) {
    const organizationId = req.user.organizationId;
    return this.usageTrackingService.getUsageTrends(organizationId, days);
  }

  @Get('endpoints')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get top API endpoints by usage' })
  @ApiResponse({ status: 200, description: 'Top endpoints retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to look back', type: Number, default: 7 })
  async getTopEndpoints(
    @Request() req,
    @Query('days') days: number = 7,
  ) {
    const organizationId = req.user.organizationId;
    return this.usageTrackingService.getTopEndpoints(organizationId, days);
  }

  @Get('limits')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get organization plan limits' })
  @ApiResponse({ status: 200, description: 'Plan limits retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPlanLimits(@Request() req) {
    const organizationId = req.user.organizationId;
    const summary = await this.usageTrackingService.getUsageSummary(organizationId, 'monthly');
    
    return {
      limits: summary.limits,
      current_usage: summary.usage,
      utilization: {
        apiCalls: (summary.usage.apiCalls / summary.limits.apiCalls) * 100,
        imports: (summary.usage.imports / summary.limits.imports) * 100,
        exports: (summary.usage.exports / summary.limits.exports) * 100,
        storage: (summary.usage.storage / (summary.limits.storage * 1024 * 1024 * 1024)) * 100,
        connectors: (summary.usage.connectors / summary.limits.connectors) * 100,
      },
    };
  }

  @Get('costs')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get cost breakdown for organization' })
  @ApiResponse({ status: 200, description: 'Cost breakdown retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'period', required: false, description: 'Period for costs (daily, weekly, monthly)', enum: ['daily', 'weekly', 'monthly'], default: 'monthly' })
  async getCostBreakdown(
    @Request() req,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'monthly',
  ) {
    const organizationId = req.user.organizationId;
    const summary = await this.usageTrackingService.getUsageSummary(organizationId, period);
    
    return {
      period,
      start_date: summary.startDate,
      end_date: summary.endDate,
      costs: summary.costs,
      metrics: summary.metrics,
    };
  }
}
