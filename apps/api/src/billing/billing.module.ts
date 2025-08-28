// Created automatically by Cursor AI (2024-12-19)

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BillingService } from './billing.service'
import { BillingController } from './billing.controller'
import { RlsService } from '../database/rls.service'
import { TelemetryService } from '../observability/telemetry.service'
import { SentryService } from '../observability/sentry.service'

@Module({
  imports: [ConfigModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    RlsService,
    TelemetryService,
    SentryService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
