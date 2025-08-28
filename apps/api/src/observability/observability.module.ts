// Created automatically by Cursor AI (2024-12-19)

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TelemetryService } from './telemetry.service'
import { SentryService } from './sentry.service'

@Module({
  imports: [ConfigModule],
  providers: [TelemetryService, SentryService],
  exports: [TelemetryService, SentryService],
})
export class ObservabilityModule {}
