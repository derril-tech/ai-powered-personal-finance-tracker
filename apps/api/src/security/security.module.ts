// Created automatically by Cursor AI (2024-12-19)

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { KmsService } from './kms.service'
import { SecretsRotationService } from './secrets-rotation.service'
import { SignedUrlService } from './signed-url.service'
import { SecurityHeadersMiddleware } from './security-headers.middleware'

@Module({
  imports: [ConfigModule],
  providers: [
    KmsService,
    SecretsRotationService,
    SignedUrlService,
    SecurityHeadersMiddleware,
  ],
  exports: [
    KmsService,
    SecretsRotationService,
    SignedUrlService,
    SecurityHeadersMiddleware,
  ],
})
export class SecurityModule {}
