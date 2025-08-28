// Created automatically by Cursor AI (2024-12-19)

import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { DsrService, DsrRequest } from './dsr.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { z } from 'zod'

const CreateDsrRequestSchema = z.object({
  householdId: z.string().uuid(),
  type: z.enum(['export', 'delete', 'rectification', 'portability']),
})

@ApiTags('Data Subject Rights')
@Controller('dsr')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DsrController {
  constructor(private readonly dsrService: DsrService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Create a new DSR request' })
  @ApiResponse({ status: 201, description: 'DSR request created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async createDsrRequest(
    @Request() req: any,
    @Body() body: z.infer<typeof CreateDsrRequestSchema>
  ): Promise<DsrRequest> {
    const { householdId, type } = CreateDsrRequestSchema.parse(body)
    const userId = req.user.id

    return this.dsrService.createDsrRequest(userId, householdId, type)
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get user\'s DSR requests' })
  @ApiResponse({ status: 200, description: 'DSR requests retrieved successfully' })
  async getUserDsrRequests(@Request() req: any): Promise<DsrRequest[]> {
    const userId = req.user.id
    return this.dsrService.getUserDsrRequests(userId)
  }

  @Get('requests/:requestId')
  @ApiOperation({ summary: 'Get DSR request status' })
  @ApiResponse({ status: 200, description: 'DSR request status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'DSR request not found' })
  async getDsrRequestStatus(
    @Request() req: any,
    @Param('requestId') requestId: string
  ): Promise<DsrRequest> {
    const userId = req.user.id
    return this.dsrService.getDsrRequestStatus(requestId, userId)
  }

  @Post('requests/:requestId/process')
  @ApiOperation({ summary: 'Process a DSR request (admin only)' })
  @ApiResponse({ status: 200, description: 'DSR request processed successfully' })
  @ApiResponse({ status: 404, description: 'DSR request not found' })
  async processDsrRequest(
    @Param('requestId') requestId: string
  ): Promise<void> {
    return this.dsrService.processDsrRequest(requestId)
  }

  @Post('export/:householdId')
  @ApiOperation({ summary: 'Export user data for a household' })
  @ApiResponse({ status: 200, description: 'Data export completed successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async exportUserData(
    @Request() req: any,
    @Param('householdId') householdId: string
  ): Promise<any> {
    const userId = req.user.id
    return this.dsrService.exportUserData(userId, householdId)
  }

  @Post('delete/:householdId')
  @ApiOperation({ summary: 'Delete user data for a household' })
  @ApiResponse({ status: 200, description: 'Data deletion completed successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteUserData(
    @Request() req: any,
    @Param('householdId') householdId: string
  ): Promise<void> {
    const userId = req.user.id
    return this.dsrService.deleteUserData(userId, householdId)
  }
}
