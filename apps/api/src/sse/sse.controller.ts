// Created automatically by Cursor AI (2024-12-19)

import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { MembershipRole } from '../households/entities/membership.entity'
import { SseService } from './sse.service'

@ApiTags('sse')
@Controller('sse')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Get('imports/:importId')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Subscribe to import progress updates' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async subscribeToImportProgress(
    @Param('importId') importId: string,
    @Res() res: Response,
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    const subscription = this.sseService.subscribeToImportProgress(importId, (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    })

    res.on('close', () => {
      subscription.unsubscribe()
    })
  }

  @Get('forecasts/:forecastId')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Subscribe to forecast progress updates' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async subscribeToForecastProgress(
    @Param('forecastId') forecastId: string,
    @Res() res: Response,
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    const subscription = this.sseService.subscribeToForecastProgress(forecastId, (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    })

    res.on('close', () => {
      subscription.unsubscribe()
    })
  }

  @Get('reports/:reportId')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Subscribe to report generation progress' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async subscribeToReportProgress(
    @Param('reportId') reportId: string,
    @Res() res: Response,
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    const subscription = this.sseService.subscribeToReportProgress(reportId, (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    })

    res.on('close', () => {
      subscription.unsubscribe()
    })
  }

  @Get('sync/:accountId')
  @Roles(MembershipRole.VIEWER)
  @ApiOperation({ summary: 'Subscribe to account sync progress' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async subscribeToSyncProgress(
    @Param('accountId') accountId: string,
    @Res() res: Response,
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    const subscription = this.sseService.subscribeToSyncProgress(accountId, (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    })

    res.on('close', () => {
      subscription.unsubscribe()
    })
  }
}
