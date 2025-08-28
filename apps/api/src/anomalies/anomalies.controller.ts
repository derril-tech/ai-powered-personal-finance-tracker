# Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Post, Query, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AnomaliesService } from './anomalies.service';
import { AnomalyResponseDto } from './dto/anomaly-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

@ApiTags('anomalies')
@Controller('anomalies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnomaliesController {
  constructor(private readonly anomaliesService: AnomaliesService) {}

  @Get()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get anomalies for household' })
  @ApiResponse({ status: 200, description: 'Anomalies retrieved successfully', type: [AnomalyResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'anomaly_type', required: false, description: 'Filter by anomaly type', type: String })
  @ApiQuery({ name: 'severity', required: false, description: 'Filter by severity', type: String })
  @ApiQuery({ name: 'date_from', required: false, description: 'Filter from date (ISO)', type: String })
  @ApiQuery({ name: 'date_to', required: false, description: 'Filter to date (ISO)', type: String })
  @ApiQuery({ name: 'merchant_name', required: false, description: 'Filter by merchant name', type: String })
  @ApiQuery({ name: 'category_id', required: false, description: 'Filter by category ID', type: String })
  @ApiQuery({ name: 'is_false_positive', required: false, description: 'Filter by false positive status', type: Boolean })
  @ApiQuery({ name: 'user_verdict', required: false, description: 'Filter by user verdict', type: String })
  async getAnomalies(
    @Request() req,
    @Query('anomaly_type') anomalyType?: string,
    @Query('severity') severity?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('merchant_name') merchantName?: string,
    @Query('category_id') categoryId?: string,
    @Query('is_false_positive') isFalsePositive?: boolean,
    @Query('user_verdict') userVerdict?: string,
  ): Promise<AnomalyResponseDto[]> {
    return this.anomaliesService.getAnomalies(req.user.id, {
      anomalyType,
      severity,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      merchantName,
      categoryId,
      isFalsePositive,
      userVerdict,
    });
  }

  @Get(':id')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get anomaly by ID' })
  @ApiResponse({ status: 200, description: 'Anomaly retrieved successfully', type: AnomalyResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Anomaly not found' })
  async getAnomaly(@Request() req, @Param('id') id: string): Promise<AnomalyResponseDto> {
    return this.anomaliesService.getAnomaly(req.user.id, id);
  }

  @Post(':id/verdict')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Submit verdict for anomaly' })
  @ApiResponse({ status: 200, description: 'Verdict submitted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Anomaly not found' })
  async submitVerdict(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { verdict: 'legit' | 'fraud'; reason?: string },
  ): Promise<{ success: boolean }> {
    return this.anomaliesService.submitVerdict(req.user.id, id, body.verdict, body.reason);
  }

  @Get('summary')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get anomaly summary for dashboard' })
  @ApiResponse({ status: 200, description: 'Anomaly summary retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'days_back', required: false, description: 'Number of days to look back', type: Number, default: 30 })
  async getAnomalySummary(
    @Request() req,
    @Query('days_back') daysBack?: number,
  ): Promise<{
    total_anomalies: number;
    high_severity: number;
    critical_severity: number;
    false_positives: number;
    by_type: Array<{
      anomaly_type: string;
      count: number;
      avg_score: number;
    }>;
    by_severity: Array<{
      severity: string;
      count: number;
    }>;
  }> {
    return this.anomaliesService.getAnomalySummary(req.user.id, daysBack || 30);
  }

  @Get('performance/metrics')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get anomaly detection performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPerformanceMetrics(@Request() req): Promise<{
    precision: number;
    recall: number;
    f1_score: number;
    accuracy: number;
    by_entity: Array<{
      entity_type: string;
      entity_id: string;
      entity_name: string;
      precision: number;
      recall: number;
      f1_score: number;
    }>;
  }> {
    return this.anomaliesService.getPerformanceMetrics(req.user.id);
  }

  @Get('performance/thresholds')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get threshold recommendations' })
  @ApiResponse({ status: 200, description: 'Threshold recommendations retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getThresholdRecommendations(@Request() req): Promise<{
    recommendations: Array<{
      entity_type: string;
      entity_id: string;
      entity_name: string;
      current_threshold: number;
      recommended_threshold: number;
      reason: string;
      expected_improvement: {
        precision: number;
        recall: number;
        f1_score: number;
      };
    }>;
  }> {
    return this.anomaliesService.getThresholdRecommendations(req.user.id);
  }
}
