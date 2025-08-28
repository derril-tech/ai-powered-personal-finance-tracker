# Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ForecastsService } from './forecasts.service';
import { ForecastResponseDto } from './dto/forecast-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

@ApiTags('forecasts')
@Controller('forecasts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ForecastsController {
  constructor(private readonly forecastsService: ForecastsService) {}

  @Get()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get forecasts for household' })
  @ApiResponse({ status: 200, description: 'Forecasts retrieved successfully', type: [ForecastResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'entity_type', required: false, description: 'Filter by entity type (category, account, household)', type: String })
  @ApiQuery({ name: 'entity_id', required: false, description: 'Filter by entity ID', type: String })
  @ApiQuery({ name: 'date_from', required: false, description: 'Filter from date (ISO)', type: String })
  @ApiQuery({ name: 'date_to', required: false, description: 'Filter to date (ISO)', type: String })
  @ApiQuery({ name: 'model_used', required: false, description: 'Filter by model used', type: String })
  async getForecasts(
    @Request() req,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('model_used') modelUsed?: string,
  ): Promise<ForecastResponseDto[]> {
    return this.forecastsService.getForecasts(req.user.id, {
      entityType,
      entityId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      modelUsed,
    });
  }

  @Get('summary')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get forecast summary for dashboard' })
  @ApiResponse({ status: 200, description: 'Forecast summary retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'months_ahead', required: false, description: 'Number of months to forecast', type: Number, default: 3 })
  async getForecastSummary(
    @Request() req,
    @Query('months_ahead') monthsAhead?: number,
  ): Promise<{
    total_forecasted: number;
    by_category: Array<{
      category_id: string;
      category_name: string;
      forecasted_amount: number;
      confidence: number;
    }>;
    by_account: Array<{
      account_id: string;
      account_name: string;
      forecasted_amount: number;
      confidence: number;
    }>;
  }> {
    return this.forecastsService.getForecastSummary(req.user.id, monthsAhead || 3);
  }

  @Get('trends')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get forecast trends over time' })
  @ApiResponse({ status: 200, description: 'Forecast trends retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'entity_type', required: false, description: 'Filter by entity type', type: String })
  @ApiQuery({ name: 'entity_id', required: false, description: 'Filter by entity ID', type: String })
  @ApiQuery({ name: 'months_back', required: false, description: 'Number of months to look back', type: Number, default: 6 })
  async getForecastTrends(
    @Request() req,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('months_back') monthsBack?: number,
  ): Promise<{
    dates: string[];
    actual: number[];
    forecasted: number[];
    p50_lower: number[];
    p50_upper: number[];
    p90_lower: number[];
    p90_upper: number[];
  }> {
    return this.forecastsService.getForecastTrends(req.user.id, {
      entityType,
      entityId,
      monthsBack: monthsBack || 6,
    });
  }
}
