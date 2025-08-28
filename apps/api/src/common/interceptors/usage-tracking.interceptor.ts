// Created automatically by Cursor AI (2024-12-19)

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UsageTrackingService } from '../services/usage-tracking.service';

@Injectable()
export class UsageTrackingInterceptor implements NestInterceptor {
  constructor(private readonly usageTrackingService: UsageTrackingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.trackRequest(request, response, startTime);
        } catch (error) {
          // Don't fail the request if usage tracking fails
          console.error('Usage tracking interceptor error:', error);
        }
      }),
    );
  }

  private async trackRequest(request: any, response: any, startTime: number): Promise<void> {
    const user = request.user;
    const organizationId = user?.organizationId || request.headers['x-organization-id'];
    
    if (!organizationId) {
      return; // Skip tracking if no organization context
    }

    const endpoint = request.route?.path || request.path;
    const method = request.method;
    const userId = user?.id;

    // Track API call
    await this.usageTrackingService.trackApiCall(organizationId, userId, endpoint, method);

    // Track specific operations based on endpoint
    await this.trackSpecificOperations(request, organizationId, userId, endpoint, method);
  }

  private async trackSpecificOperations(
    request: any,
    organizationId: string,
    userId: string,
    endpoint: string,
    method: string,
  ): Promise<void> {
    // Track imports
    if (endpoint.includes('/import') && method === 'POST') {
      const importType = request.body?.importType || 'unknown';
      const recordCount = request.body?.recordCount || 0;
      await this.usageTrackingService.trackImport(organizationId, userId, importType, recordCount);
    }

    // Track exports
    if (endpoint.includes('/export') && method === 'POST') {
      const exportType = request.body?.exportType || 'unknown';
      const fileSize = request.body?.fileSize || 0;
      await this.usageTrackingService.trackExport(organizationId, userId, exportType, fileSize);
    }

    // Track reports
    if (endpoint.includes('/reports') && method === 'POST') {
      const reportType = request.body?.reportType || 'unknown';
      const format = request.body?.format || 'pdf';
      await this.usageTrackingService.trackReport(organizationId, userId, reportType, format);
    }

    // Track forecasts
    if (endpoint.includes('/forecasts') && method === 'GET') {
      const forecastType = request.query?.entity_type || 'general';
      await this.usageTrackingService.trackForecast(organizationId, userId, forecastType);
    }

    // Track anomaly checks
    if (endpoint.includes('/anomalies') && method === 'GET') {
      await this.usageTrackingService.trackAnomalyCheck(organizationId, userId);
    }

    // Track connector syncs
    if (endpoint.includes('/connectors/sync') && method === 'POST') {
      const connectorId = request.body?.connectorId || request.params?.id;
      await this.usageTrackingService.trackConnectorSync(organizationId, connectorId);
    }
  }
}
