# Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportResponseDto } from './dto/report-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get all reports for household' })
  @ApiResponse({ status: 200, description: 'Reports retrieved successfully', type: [ReportResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getReports(@Request() req): Promise<ReportResponseDto[]> {
    return this.reportsService.getReports(req.user.id);
  }

  @Get(':id')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get report by ID' })
  @ApiResponse({ status: 200, description: 'Report retrieved successfully', type: ReportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReport(@Request() req, @Param('id') id: string): Promise<ReportResponseDto> {
    return this.reportsService.getReport(req.user.id, id);
  }

  @Post()
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Create report' })
  @ApiResponse({ status: 201, description: 'Report created successfully', type: ReportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createReport(
    @Request() req,
    @Body() createReportDto: CreateReportDto,
  ): Promise<ReportResponseDto> {
    return this.reportsService.createReport(req.user.id, createReportDto);
  }

  @Post('monthly')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Generate monthly report' })
  @ApiResponse({ status: 201, description: 'Monthly report generated successfully', type: ReportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async generateMonthlyReport(
    @Request() req,
    @Body() body: { 
      year: number; 
      month: number; 
      format: 'pdf' | 'xlsx' | 'csv' | 'html';
      include_forecasts?: boolean;
      include_anomalies?: boolean;
    },
  ): Promise<ReportResponseDto> {
    return this.reportsService.generateMonthlyReport(req.user.id, body);
  }

  @Post('budget-analysis')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Generate budget analysis report' })
  @ApiResponse({ status: 201, description: 'Budget analysis report generated successfully', type: ReportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async generateBudgetAnalysisReport(
    @Request() req,
    @Body() body: { 
      budget_id: string; 
      format: 'pdf' | 'xlsx' | 'csv' | 'html';
      include_recommendations?: boolean;
    },
  ): Promise<ReportResponseDto> {
    return this.reportsService.generateBudgetAnalysisReport(req.user.id, body);
  }

  @Post('transaction-details')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Generate transaction details report' })
  @ApiResponse({ status: 201, description: 'Transaction details report generated successfully', type: ReportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async generateTransactionDetailsReport(
    @Request() req,
    @Body() body: { 
      date_from: string; 
      date_to: string; 
      format: 'pdf' | 'xlsx' | 'csv' | 'html';
      account_ids?: string[];
      category_ids?: string[];
      include_splits?: boolean;
    },
  ): Promise<ReportResponseDto> {
    return this.reportsService.generateTransactionDetailsReport(req.user.id, body);
  }

  @Post('forecast-report')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Generate forecast report' })
  @ApiResponse({ status: 201, description: 'Forecast report generated successfully', type: ReportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async generateForecastReport(
    @Request() req,
    @Body() body: { 
      months_ahead: number; 
      format: 'pdf' | 'xlsx' | 'csv' | 'html';
      entity_type?: string;
      entity_id?: string;
      include_confidence_intervals?: boolean;
    },
  ): Promise<ReportResponseDto> {
    return this.reportsService.generateForecastReport(req.user.id, body);
  }

  @Post('anomaly-report')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Generate anomaly report' })
  @ApiResponse({ status: 201, description: 'Anomaly report generated successfully', type: ReportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async generateAnomalyReport(
    @Request() req,
    @Body() body: { 
      date_from: string; 
      date_to: string; 
      format: 'pdf' | 'xlsx' | 'csv' | 'html';
      severity?: string[];
      include_performance_metrics?: boolean;
    },
  ): Promise<ReportResponseDto> {
    return this.reportsService.generateAnomalyReport(req.user.id, body);
  }
}
