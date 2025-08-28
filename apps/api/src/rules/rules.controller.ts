# Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Post, Put, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { RuleResponseDto } from './dto/rule-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

@ApiTags('rules')
@Controller('rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get all rules for household' })
  @ApiResponse({ status: 200, description: 'Rules retrieved successfully', type: [RuleResponseDto] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getRules(@Request() req): Promise<RuleResponseDto[]> {
    return this.rulesService.getRules(req.user.id);
  }

  @Get(':id')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get rule by ID' })
  @ApiResponse({ status: 200, description: 'Rule retrieved successfully', type: RuleResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async getRule(@Request() req, @Param('id') id: string): Promise<RuleResponseDto> {
    return this.rulesService.getRule(req.user.id, id);
  }

  @Post()
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Create rule' })
  @ApiResponse({ status: 201, description: 'Rule created successfully', type: RuleResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createRule(
    @Request() req,
    @Body() createRuleDto: CreateRuleDto,
  ): Promise<RuleResponseDto> {
    return this.rulesService.createRule(req.user.id, createRuleDto);
  }

  @Put(':id')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Update rule' })
  @ApiResponse({ status: 200, description: 'Rule updated successfully', type: RuleResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async updateRule(
    @Request() req,
    @Param('id') id: string,
    @Body() updateRuleDto: UpdateRuleDto,
  ): Promise<RuleResponseDto> {
    return this.rulesService.updateRule(req.user.id, id, updateRuleDto);
  }

  @Delete(':id')
  @Roles(MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Delete rule' })
  @ApiResponse({ status: 200, description: 'Rule deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async deleteRule(@Request() req, @Param('id') id: string): Promise<void> {
    return this.rulesService.deleteRule(req.user.id, id);
  }

  @Post(':id/apply')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Apply rule to existing transactions' })
  @ApiResponse({ status: 200, description: 'Rule applied successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async applyRule(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { dry_run?: boolean },
  ): Promise<{ updated_count: number; affected_transactions: string[] }> {
    return this.rulesService.applyRule(req.user.id, id, body.dry_run);
  }

  @Post('test')
  @Roles(MembershipRole.MEMBER)
  @ApiOperation({ summary: 'Test rule against sample transaction' })
  @ApiResponse({ status: 200, description: 'Rule test completed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async testRule(
    @Request() req,
    @Body() body: {
      conditions: any[];
      actions: any[];
      test_transaction: {
        description: string;
        merchant_name?: string;
        amount: number;
        date: string;
      };
    },
  ): Promise<{ matches: boolean; actions: any[] }> {
    return this.rulesService.testRule(req.user.id, body.conditions, body.actions, body.test_transaction);
  }
}
