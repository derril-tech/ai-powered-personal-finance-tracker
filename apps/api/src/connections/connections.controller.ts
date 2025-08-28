// Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConnectionsService } from './connections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MembershipRole } from '../households/entities/membership.entity';

interface CreateConnectionDto {
  provider: 'plaid' | 'tink' | 'truelayer';
}

@ApiTags('connections')
@Controller('connections')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Get()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Get all connections for household' })
  @ApiResponse({ status: 200, description: 'Connections retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getConnections(@Request() req) {
    const householdId = req.user.householdId;
    return this.connectionsService.getConnectionsByHousehold(householdId);
  }

  @Post()
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Create a new bank connection' })
  @ApiResponse({ status: 201, description: 'Connection created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createConnection(@Body() createConnectionDto: CreateConnectionDto, @Request() req) {
    const householdId = req.user.householdId;
    return this.connectionsService.createConnection(createConnectionDto.provider, householdId);
  }
}
