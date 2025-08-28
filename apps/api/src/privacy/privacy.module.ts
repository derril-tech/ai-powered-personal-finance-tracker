// Created automatically by Cursor AI (2024-12-19)

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DsrService } from './dsr.service'
import { DsrController } from './dsr.controller'
import { RlsService } from '../database/rls.service'
import { SignedUrlService } from '../security/signed-url.service'
import { TelemetryService } from '../observability/telemetry.service'
import { SentryService } from '../observability/sentry.service'

@Module({
  imports: [ConfigModule],
  providers: [
    DsrService,
    RlsService,
    SignedUrlService,
    TelemetryService,
    SentryService,
  ],
  controllers: [DsrController],
  exports: [DsrService],
})
export class PrivacyModule {}
