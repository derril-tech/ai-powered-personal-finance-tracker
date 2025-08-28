// Created automatically by Cursor AI (2024-12-19)

import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { BillingService } from './billing.service'

@Injectable()
export class UsageTrackingMiddleware implements NestMiddleware {
  constructor(private billingService: BillingService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Skip tracking for certain endpoints
    if (this.shouldSkipTracking(req.path)) {
      return next()
    }

    // Get organization ID from request (set by auth middleware)
    const organizationId = (req as any).user?.organizationId
    const userId = (req as any).user?.userId

    if (!organizationId) {
      return next()
    }

    // Track API call
    this.billingService.recordUsageEvent(
      organizationId,
      'api_call',
      1,
      userId,
      {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      }
    ).catch(error => {
      // Don't block the request if usage tracking fails
      console.error('Failed to track usage:', error)
    })

    next()
  }

  private shouldSkipTracking(path: string): boolean {
    const skipPaths = [
      '/health',
      '/metrics',
      '/docs',
      '/api-docs',
      '/billing/usage', // Avoid double counting
      '/billing/usage/events', // Avoid double counting
    ]

    return skipPaths.some(skipPath => path.startsWith(skipPath))
  }
}
