// Created automatically by Cursor AI (2024-12-19)

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Organization } from '../organizations/entities/organization.entity';
import { UsageRecord } from './entities/usage-record.entity';

export interface UsageMetrics {
  totalRequests: number;
  apiCalls: number;
  imports: number;
  exports: number;
  reports: number;
  forecasts: number;
  anomalyChecks: number;
  storageBytes: number;
  connectorSyncs: number;
}

export interface CostBreakdown {
  baseCost: number;
  apiCallsCost: number;
  importsCost: number;
  exportsCost: number;
  reportsCost: number;
  forecastsCost: number;
  storageCost: number;
  connectorCost: number;
  totalCost: number;
}

export interface UsageSummary {
  organizationId: string;
  period: string; // 'daily', 'weekly', 'monthly'
  startDate: Date;
  endDate: Date;
  metrics: UsageMetrics;
  costs: CostBreakdown;
  limits: {
    apiCalls: number;
    imports: number;
    exports: number;
    storage: number;
    connectors: number;
  };
  usage: {
    apiCalls: number;
    imports: number;
    exports: number;
    storage: number;
    connectors: number;
  };
}

@Injectable()
export class UsageTrackingService {
  private readonly COST_PER_API_CALL = 0.001; // $0.001 per API call
  private readonly COST_PER_IMPORT = 0.01; // $0.01 per import
  private readonly COST_PER_EXPORT = 0.05; // $0.05 per export
  private readonly COST_PER_REPORT = 0.02; // $0.02 per report
  private readonly COST_PER_FORECAST = 0.005; // $0.005 per forecast
  private readonly COST_PER_STORAGE_GB = 0.023; // $0.023 per GB per month
  private readonly COST_PER_CONNECTOR = 0.01; // $0.01 per connector sync

  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(UsageRecord)
    private usageRecordRepository: Repository<UsageRecord>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async trackApiCall(organizationId: string, userId: string, endpoint: string, method: string): Promise<void> {
    const timestamp = new Date();
    const bucket = this.getTimeBucket(timestamp);

    // Track in Redis for real-time access
    const redisKey = `usage:org:${organizationId}:${bucket}`;
    await this.redis.hincrby(redisKey, 'api_calls', 1);
    await this.redis.hincrby(redisKey, 'total_requests', 1);
    await this.redis.expire(redisKey, 24 * 60 * 60); // 24 hours

    // Track endpoint-specific usage
    const endpointKey = `usage:org:${organizationId}:endpoint:${bucket}`;
    await this.redis.hincrby(endpointKey, `${method}:${endpoint}`, 1);
    await this.redis.expire(endpointKey, 24 * 60 * 60);

    // Store in database for historical analysis
    await this.storeUsageRecord({
      organizationId,
      userId,
      recordType: 'api_call',
      endpoint,
      method,
      timestamp,
      metadata: { bucket },
    });
  }

  async trackImport(organizationId: string, userId: string, importType: string, recordCount: number): Promise<void> {
    const timestamp = new Date();
    const bucket = this.getTimeBucket(timestamp);

    const redisKey = `usage:org:${organizationId}:${bucket}`;
    await this.redis.hincrby(redisKey, 'imports', 1);
    await this.redis.hincrby(redisKey, 'total_requests', 1);
    await this.redis.expire(redisKey, 24 * 60 * 60);

    await this.storeUsageRecord({
      organizationId,
      userId,
      recordType: 'import',
      endpoint: 'import',
      method: 'POST',
      timestamp,
      metadata: { 
        bucket,
        importType,
        recordCount,
      },
    });
  }

  async trackExport(organizationId: string, userId: string, exportType: string, fileSize: number): Promise<void> {
    const timestamp = new Date();
    const bucket = this.getTimeBucket(timestamp);

    const redisKey = `usage:org:${organizationId}:${bucket}`;
    await this.redis.hincrby(redisKey, 'exports', 1);
    await this.redis.hincrby(redisKey, 'total_requests', 1);
    await this.redis.hincrby(redisKey, 'storage_bytes', fileSize);
    await this.redis.expire(redisKey, 24 * 60 * 60);

    await this.storeUsageRecord({
      organizationId,
      userId,
      recordType: 'export',
      endpoint: 'export',
      method: 'POST',
      timestamp,
      metadata: { 
        bucket,
        exportType,
        fileSize,
      },
    });
  }

  async trackReport(organizationId: string, userId: string, reportType: string, format: string): Promise<void> {
    const timestamp = new Date();
    const bucket = this.getTimeBucket(timestamp);

    const redisKey = `usage:org:${organizationId}:${bucket}`;
    await this.redis.hincrby(redisKey, 'reports', 1);
    await this.redis.hincrby(redisKey, 'total_requests', 1);
    await this.redis.expire(redisKey, 24 * 60 * 60);

    await this.storeUsageRecord({
      organizationId,
      userId,
      recordType: 'report',
      endpoint: 'reports',
      method: 'POST',
      timestamp,
      metadata: { 
        bucket,
        reportType,
        format,
      },
    });
  }

  async trackForecast(organizationId: string, userId: string, forecastType: string): Promise<void> {
    const timestamp = new Date();
    const bucket = this.getTimeBucket(timestamp);

    const redisKey = `usage:org:${organizationId}:${bucket}`;
    await this.redis.hincrby(redisKey, 'forecasts', 1);
    await this.redis.hincrby(redisKey, 'total_requests', 1);
    await this.redis.expire(redisKey, 24 * 60 * 60);

    await this.storeUsageRecord({
      organizationId,
      userId,
      recordType: 'forecast',
      endpoint: 'forecasts',
      method: 'GET',
      timestamp,
      metadata: { 
        bucket,
        forecastType,
      },
    });
  }

  async trackAnomalyCheck(organizationId: string, userId: string): Promise<void> {
    const timestamp = new Date();
    const bucket = this.getTimeBucket(timestamp);

    const redisKey = `usage:org:${organizationId}:${bucket}`;
    await this.redis.hincrby(redisKey, 'anomaly_checks', 1);
    await this.redis.hincrby(redisKey, 'total_requests', 1);
    await this.redis.expire(redisKey, 24 * 60 * 60);

    await this.storeUsageRecord({
      organizationId,
      userId,
      recordType: 'anomaly_check',
      endpoint: 'anomalies',
      method: 'GET',
      timestamp,
      metadata: { bucket },
    });
  }

  async trackStorage(organizationId: string, bytesUsed: number): Promise<void> {
    const timestamp = new Date();
    const bucket = this.getTimeBucket(timestamp);

    const redisKey = `usage:org:${organizationId}:${bucket}`;
    await this.redis.hincrby(redisKey, 'storage_bytes', bytesUsed);
    await this.redis.expire(redisKey, 24 * 60 * 60);

    await this.storeUsageRecord({
      organizationId,
      userId: null,
      recordType: 'storage',
      endpoint: 'storage',
      method: 'UPDATE',
      timestamp,
      metadata: { 
        bucket,
        bytesUsed,
      },
    });
  }

  async trackConnectorSync(organizationId: string, connectorId: string): Promise<void> {
    const timestamp = new Date();
    const bucket = this.getTimeBucket(timestamp);

    const redisKey = `usage:org:${organizationId}:${bucket}`;
    await this.redis.hincrby(redisKey, 'connector_syncs', 1);
    await this.redis.hincrby(redisKey, 'total_requests', 1);
    await this.redis.expire(redisKey, 24 * 60 * 60);

    await this.storeUsageRecord({
      organizationId,
      userId: null,
      recordType: 'connector_sync',
      endpoint: 'connectors/sync',
      method: 'POST',
      timestamp,
      metadata: { 
        bucket,
        connectorId,
      },
    });
  }

  async getUsageSummary(organizationId: string, period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<UsageSummary> {
    const now = new Date();
    const { startDate, endDate } = this.getPeriodDates(now, period);
    
    // Get organization limits
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Get usage metrics from database
    const metrics = await this.getUsageMetrics(organizationId, startDate, endDate);
    
    // Calculate costs
    const costs = this.calculateCosts(metrics);
    
    // Get current usage from Redis
    const currentUsage = await this.getCurrentUsage(organizationId);

    return {
      organizationId,
      period,
      startDate,
      endDate,
      metrics,
      costs,
      limits: {
        apiCalls: organization.planLimits?.apiCalls || 10000,
        imports: organization.planLimits?.imports || 100,
        exports: organization.planLimits?.exports || 50,
        storage: organization.planLimits?.storageGB || 10,
        connectors: organization.planLimits?.connectors || 5,
      },
      usage: currentUsage,
    };
  }

  async getCurrentUsage(organizationId: string): Promise<any> {
    const now = new Date();
    const bucket = this.getTimeBucket(now);
    const redisKey = `usage:org:${organizationId}:${bucket}`;

    const usage = await this.redis.hgetall(redisKey);
    
    return {
      apiCalls: parseInt(usage.api_calls || '0', 10),
      imports: parseInt(usage.imports || '0', 10),
      exports: parseInt(usage.exports || '0', 10),
      storage: parseInt(usage.storage_bytes || '0', 10),
      connectors: parseInt(usage.connector_syncs || '0', 10),
    };
  }

  async getUsageTrends(organizationId: string, days: number = 30): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    const records = await this.usageRecordRepository
      .createQueryBuilder('record')
      .select([
        'DATE(record.timestamp) as date',
        'record.recordType as type',
        'COUNT(*) as count',
        'SUM(CAST(record.metadata->>\'fileSize\' AS INTEGER)) as total_size',
      ])
      .where('record.organizationId = :organizationId', { organizationId })
      .andWhere('record.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('DATE(record.timestamp), record.recordType')
      .orderBy('date', 'ASC')
      .getRawMany();

    return records;
  }

  async getTopEndpoints(organizationId: string, days: number = 7): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    const records = await this.usageRecordRepository
      .createQueryBuilder('record')
      .select([
        'record.endpoint',
        'record.method',
        'COUNT(*) as count',
      ])
      .where('record.organizationId = :organizationId', { organizationId })
      .andWhere('record.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('record.recordType = :recordType', { recordType: 'api_call' })
      .groupBy('record.endpoint, record.method')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return records;
  }

  private async getUsageMetrics(organizationId: string, startDate: Date, endDate: Date): Promise<UsageMetrics> {
    const records = await this.usageRecordRepository
      .createQueryBuilder('record')
      .select([
        'record.recordType',
        'COUNT(*) as count',
        'SUM(CAST(record.metadata->>\'fileSize\' AS INTEGER)) as total_size',
      ])
      .where('record.organizationId = :organizationId', { organizationId })
      .andWhere('record.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('record.recordType')
      .getRawMany();

    const metrics: UsageMetrics = {
      totalRequests: 0,
      apiCalls: 0,
      imports: 0,
      exports: 0,
      reports: 0,
      forecasts: 0,
      anomalyChecks: 0,
      storageBytes: 0,
      connectorSyncs: 0,
    };

    records.forEach(record => {
      const count = parseInt(record.count, 10);
      const size = parseInt(record.total_size || '0', 10);

      switch (record.recordType) {
        case 'api_call':
          metrics.apiCalls += count;
          metrics.totalRequests += count;
          break;
        case 'import':
          metrics.imports += count;
          metrics.totalRequests += count;
          break;
        case 'export':
          metrics.exports += count;
          metrics.totalRequests += count;
          metrics.storageBytes += size;
          break;
        case 'report':
          metrics.reports += count;
          metrics.totalRequests += count;
          break;
        case 'forecast':
          metrics.forecasts += count;
          metrics.totalRequests += count;
          break;
        case 'anomaly_check':
          metrics.anomalyChecks += count;
          metrics.totalRequests += count;
          break;
        case 'storage':
          metrics.storageBytes += size;
          break;
        case 'connector_sync':
          metrics.connectorSyncs += count;
          metrics.totalRequests += count;
          break;
      }
    });

    return metrics;
  }

  private calculateCosts(metrics: UsageMetrics): CostBreakdown {
    const storageGB = metrics.storageBytes / (1024 * 1024 * 1024);

    return {
      baseCost: 0, // Base cost is handled by subscription
      apiCallsCost: metrics.apiCalls * this.COST_PER_API_CALL,
      importsCost: metrics.imports * this.COST_PER_IMPORT,
      exportsCost: metrics.exports * this.COST_PER_EXPORT,
      reportsCost: metrics.reports * this.COST_PER_REPORT,
      forecastsCost: metrics.forecasts * this.COST_PER_FORECAST,
      storageCost: storageGB * this.COST_PER_STORAGE_GB,
      connectorCost: metrics.connectorSyncs * this.COST_PER_CONNECTOR,
      totalCost: 
        metrics.apiCalls * this.COST_PER_API_CALL +
        metrics.imports * this.COST_PER_IMPORT +
        metrics.exports * this.COST_PER_EXPORT +
        metrics.reports * this.COST_PER_REPORT +
        metrics.forecasts * this.COST_PER_FORECAST +
        storageGB * this.COST_PER_STORAGE_GB +
        metrics.connectorSyncs * this.COST_PER_CONNECTOR,
    };
  }

  private async storeUsageRecord(data: {
    organizationId: string;
    userId: string | null;
    recordType: string;
    endpoint: string;
    method: string;
    timestamp: Date;
    metadata: any;
  }): Promise<void> {
    const record = this.usageRecordRepository.create({
      organizationId: data.organizationId,
      userId: data.userId,
      recordType: data.recordType,
      endpoint: data.endpoint,
      method: data.method,
      timestamp: data.timestamp,
      metadata: data.metadata,
    });

    await this.usageRecordRepository.save(record);
  }

  private getTimeBucket(date: Date): number {
    // 15-minute buckets
    return Math.floor(date.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000);
  }

  private getPeriodDates(date: Date, period: 'daily' | 'weekly' | 'monthly'): { startDate: Date; endDate: Date } {
    const endDate = new Date(date);
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate = new Date(date);
        startDate.setDate(date.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(date);
        startDate.setMonth(date.getMonth() - 1);
        break;
      default:
        startDate = new Date(date);
        startDate.setMonth(date.getMonth() - 1);
    }

    return { startDate, endDate };
  }
}
