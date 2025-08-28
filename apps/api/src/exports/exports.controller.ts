# Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ExportsService } from './exports.service';
import { CreateExportDto } from './dto/create-export.dto';
import { ExportResponseDto } from './dto/export-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

@ApiTags('exports')
@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get all exports for household' })
  @ApiResponse({ status: 200, description: 'Exports retrieved successfully', type: [ExportResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getExports(@Request() req): Promise<ExportResponseDto[]> {
    return this.exportsService.getExports(req.user.id);
  }

  @Get(':id')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get export by ID' })
  @ApiResponse({ status: 200, description: 'Export retrieved successfully', type: ExportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Export not found' })
  async getExport(@Request() req, @Param('id') id: string): Promise<ExportResponseDto> {
    return this.exportsService.getExport(req.user.id, id);
  }

  @Post()
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Create export' })
  @ApiResponse({ status: 201, description: 'Export created successfully', type: ExportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createExport(
    @Request() req,
    @Body() createExportDto: CreateExportDto,
  ): Promise<ExportResponseDto> {
    return this.exportsService.createExport(req.user.id, createExportDto);
  }

  @Post('ledger')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Export ledger (double-entry bookkeeping format)' })
  @ApiResponse({ status: 201, description: 'Ledger export created successfully', type: ExportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportLedger(
    @Request() req,
    @Body() body: { 
      date_from: string; 
      date_to: string; 
      format: 'json' | 'csv' | 'zip';
      include_splits?: boolean;
      include_metadata?: boolean;
    },
  ): Promise<ExportResponseDto> {
    return this.exportsService.exportLedger(req.user.id, body);
  }

  @Post('full-household')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Export full household data' })
  @ApiResponse({ status: 201, description: 'Full household export created successfully', type: ExportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportFullHousehold(
    @Request() req,
    @Body() body: { 
      format: 'json' | 'csv' | 'zip';
      include_attachments?: boolean;
      password_protected?: boolean;
    },
  ): Promise<ExportResponseDto> {
    return this.exportsService.exportFullHousehold(req.user.id, body);
  }

  @Post('transactions-only')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Export transactions only' })
  @ApiResponse({ status: 201, description: 'Transactions export created successfully', type: ExportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportTransactionsOnly(
    @Request() req,
    @Body() body: { 
      date_from?: string; 
      date_to?: string; 
      format: 'json' | 'csv' | 'zip';
      include_categories?: boolean;
    },
  ): Promise<ExportResponseDto> {
    return this.exportsService.exportTransactionsOnly(req.user.id, body);
  }

  @Post('budgets-only')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Export budgets only' })
  @ApiResponse({ status: 201, description: 'Budgets export created successfully', type: ExportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportBudgetsOnly(
    @Request() req,
    @Body() body: { 
      format: 'json' | 'csv' | 'zip';
      include_categories?: boolean;
    },
  ): Promise<ExportResponseDto> {
    return this.exportsService.exportBudgetsOnly(req.user.id, body);
  }

  @Post('reports-only')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Export reports only' })
  @ApiResponse({ status: 201, description: 'Reports export created successfully', type: ExportResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportReportsOnly(
    @Request() req,
    @Body() body: { 
      format: 'json' | 'csv' | 'zip';
      include_metadata?: boolean;
    },
  ): Promise<ExportResponseDto> {
    return this.exportsService.exportReportsOnly(req.user.id, body);
  }
}
