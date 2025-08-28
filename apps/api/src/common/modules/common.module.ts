// Created automatically by Cursor AI (2024-12-19)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { UsageTrackingInterceptor } from '../interceptors/usage-tracking.interceptor';
import { UsageController } from '../controllers/usage.controller';
import { UsageRecord } from '../entities/usage-record.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsageRecord, Organization]),
    RedisModule,
  ],
  providers: [
    RateLimitMiddleware,
    UsageTrackingService,
    UsageTrackingInterceptor,
  ],
  controllers: [UsageController],
  exports: [
    RateLimitMiddleware,
    UsageTrackingService,
    UsageTrackingInterceptor,
  ],
})
export class CommonModule {}
