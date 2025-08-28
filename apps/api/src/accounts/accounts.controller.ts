// Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

@ApiTags('accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get all accounts for household' })
  @ApiResponse({ status: 200, description: 'Accounts retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAccounts(@Request() req) {
    const householdId = req.user.householdId;
    return this.accountsService.getAccountsByHousehold(householdId);
  }

  @Get(':id')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiResponse({ status: 200, description: 'Account retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccount(@Param('id') id: string, @Request() req) {
    const householdId = req.user.householdId;
    return this.accountsService.getAccountById(id, householdId);
  }

  @Post(':id/sync')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Sync account data' })
  @ApiResponse({ status: 200, description: 'Account synced successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async syncAccount(@Param('id') id: string, @Request() req) {
    const householdId = req.user.householdId;
    return this.accountsService.syncAccount(id, householdId);
  }
}
