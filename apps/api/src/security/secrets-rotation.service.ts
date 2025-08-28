// Created automatically by Cursor AI (2024-12-19)

import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { KmsService } from './kms.service'
import { TelemetryService } from '../observability/telemetry.service'
import { SentryService } from '../observability/sentry.service'

export interface SecretRotationConfig {
  type: 'connector_token' | 'api_key' | 'webhook_secret' | 'database_password'
  rotationInterval: number // days
  warningDays: number // days before expiry to warn
  autoRotate: boolean
  maxAge: number // days
}

export interface SecretMetadata {
  id: string
  type: string
  createdAt: Date
  expiresAt?: Date
  lastRotatedAt: Date
  rotationCount: number
  status: 'active' | 'expired' | 'warning' | 'rotating'
}

@Injectable()
export class SecretsRotationService implements OnModuleInit {
  private rotationConfigs: Map<string, SecretRotationConfig> = new Map()

  constructor(
    private configService: ConfigService,
    private kmsService: KmsService,
    private telemetryService: TelemetryService,
    private sentryService: SentryService,
  ) {}

  async onModuleInit() {
    await this.initializeRotationConfigs()
  }

  private async initializeRotationConfigs() {
    // Default rotation configurations
    this.rotationConfigs.set('connector_token', {
      type: 'connector_token',
      rotationInterval: 90, // 90 days
      warningDays: 7, // 7 days before expiry
      autoRotate: true,
      maxAge: 365, // 1 year max
    })

    this.rotationConfigs.set('api_key', {
      type: 'api_key',
      rotationInterval: 180, // 180 days
      warningDays: 14, // 14 days before expiry
      autoRotate: false, // Manual rotation for API keys
      maxAge: 730, // 2 years max
    })

    this.rotationConfigs.set('webhook_secret', {
      type: 'webhook_secret',
      rotationInterval: 365, // 1 year
      warningDays: 30, // 30 days before expiry
      autoRotate: true,
      maxAge: 1095, // 3 years max
    })

    this.rotationConfigs.set('database_password', {
      type: 'database_password',
      rotationInterval: 90, // 90 days
      warningDays: 7, // 7 days before expiry
      autoRotate: true,
      maxAge: 365, // 1 year max
    })

    console.log('Secrets rotation service initialized')
  }

  // Daily cron job to check for secrets that need rotation
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkSecretsRotation() {
    const span = this.telemetryService.startSpan('check_secrets_rotation')
    
    try {
      span.setAttribute('operation', 'daily_rotation_check')
      
      // Get all secrets that need attention
      const secretsToRotate = await this.getSecretsNeedingRotation()
      const secretsToWarn = await this.getSecretsNeedingWarning()
      
      span.setAttribute('secrets_to_rotate', secretsToRotate.length)
      span.setAttribute('secrets_to_warn', secretsToWarn.length)

      // Process secrets that need rotation
      for (const secret of secretsToRotate) {
        await this.rotateSecret(secret.id, secret.type)
      }

      // Send warnings for secrets approaching expiry
      for (const secret of secretsToWarn) {
        await this.sendRotationWarning(secret)
      }

      span.setStatus({ code: 0, message: 'Rotation check completed' })
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Rotation check failed' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'secrets_rotation_failure' },
      })
    } finally {
      span.span.end()
    }
  }

  async getSecretsNeedingRotation(): Promise<SecretMetadata[]> {
    const now = new Date()
    const secrets: SecretMetadata[] = []

    // This would typically query the database for secrets
    // For now, we'll return an empty array as a placeholder
    // In a real implementation, you'd query your secrets table
    
    return secrets.filter(secret => {
      const config = this.rotationConfigs.get(secret.type)
      if (!config || !config.autoRotate) return false

      const daysSinceRotation = (now.getTime() - secret.lastRotatedAt.getTime()) / (1000 * 60 * 60 * 24)
      return daysSinceRotation >= config.rotationInterval
    })
  }

  async getSecretsNeedingWarning(): Promise<SecretMetadata[]> {
    const now = new Date()
    const secrets: SecretMetadata[] = []

    // This would typically query the database for secrets
    // For now, we'll return an empty array as a placeholder
    
    return secrets.filter(secret => {
      const config = this.rotationConfigs.get(secret.type)
      if (!config || !secret.expiresAt) return false

      const daysUntilExpiry = (secret.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      return daysUntilExpiry <= config.warningDays && daysUntilExpiry > 0
    })
  }

  async rotateSecret(secretId: string, secretType: string): Promise<void> {
    const span = this.telemetryService.startSpan('rotate_secret')
    
    try {
      span.setAttribute('secret_id', secretId)
      span.setAttribute('secret_type', secretType)

      const config = this.rotationConfigs.get(secretType)
      if (!config) {
        throw new Error(`No rotation config found for secret type: ${secretType}`)
      }

      // Update secret status to rotating
      await this.updateSecretStatus(secretId, 'rotating')

      // Generate new secret based on type
      let newSecret: string
      switch (secretType) {
        case 'connector_token':
          newSecret = await this.rotateConnectorToken(secretId)
          break
        case 'api_key':
          newSecret = await this.rotateApiKey(secretId)
          break
        case 'webhook_secret':
          newSecret = await this.rotateWebhookSecret(secretId)
          break
        case 'database_password':
          newSecret = await this.rotateDatabasePassword(secretId)
          break
        default:
          throw new Error(`Unknown secret type: ${secretType}`)
      }

      // Update the secret in the database
      await this.updateSecret(secretId, newSecret)

      // Update secret metadata
      await this.updateSecretMetadata(secretId, {
        lastRotatedAt: new Date(),
        rotationCount: await this.incrementRotationCount(secretId),
        status: 'active',
      })

      // Log the rotation
      this.telemetryService.recordUserAction('system', 'secret_rotated', {
        secretId,
        secretType,
        rotationCount: await this.getRotationCount(secretId),
      })

      span.setStatus({ code: 0, message: 'Secret rotated successfully' })
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Secret rotation failed' })
      
      // Update secret status back to active if rotation failed
      await this.updateSecretStatus(secretId, 'active')
      
      this.sentryService.captureException(error, {
        tags: { 
          error_type: 'secret_rotation_failure',
          secret_id: secretId,
          secret_type: secretType,
        },
      })
      
      throw error
    } finally {
      span.span.end()
    }
  }

  private async rotateConnectorToken(secretId: string): Promise<string> {
    // This would typically:
    // 1. Get the current connector details
    // 2. Call the connector's API to refresh the token
    // 3. Return the new token
    
    // For now, generate a mock token
    const crypto = require('crypto')
    return crypto.randomBytes(32).toString('hex')
  }

  private async rotateApiKey(secretId: string): Promise<string> {
    // Generate a new API key
    const crypto = require('crypto')
    return `sk_${crypto.randomBytes(32).toString('hex')}`
  }

  private async rotateWebhookSecret(secretId: string): Promise<string> {
    // Generate a new webhook secret
    const crypto = require('crypto')
    return crypto.randomBytes(64).toString('hex')
  }

  private async rotateDatabasePassword(secretId: string): Promise<string> {
    // Generate a new database password
    const crypto = require('crypto')
    return crypto.randomBytes(16).toString('base64')
  }

  async sendRotationWarning(secret: SecretMetadata): Promise<void> {
    const config = this.rotationConfigs.get(secret.type)
    if (!config) return

    const daysUntilExpiry = secret.expiresAt 
      ? (secret.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      : 0

    const message = `Secret ${secret.id} (${secret.type}) will expire in ${Math.ceil(daysUntilExpiry)} days`
    
    this.sentryService.captureMessage(message, {
      tags: {
        event_type: 'secret_rotation_warning',
        secret_id: secret.id,
        secret_type: secret.type,
      },
      level: 'warning',
    })

    // In a real implementation, you might also:
    // - Send email notifications to admins
    // - Create alerts in your monitoring system
    // - Log to audit trail
  }

  async getSecretMetadata(secretId: string): Promise<SecretMetadata | null> {
    // This would query the database for secret metadata
    // For now, return null as placeholder
    return null
  }

  async updateSecretStatus(secretId: string, status: SecretMetadata['status']): Promise<void> {
    // This would update the secret status in the database
    console.log(`Updating secret ${secretId} status to ${status}`)
  }

  async updateSecret(secretId: string, newSecret: string): Promise<void> {
    // This would update the secret in the database
    console.log(`Updating secret ${secretId}`)
  }

  async updateSecretMetadata(secretId: string, updates: Partial<SecretMetadata>): Promise<void> {
    // This would update the secret metadata in the database
    console.log(`Updating secret metadata for ${secretId}`, updates)
  }

  async incrementRotationCount(secretId: string): Promise<number> {
    // This would increment and return the rotation count
    return 1
  }

  async getRotationCount(secretId: string): Promise<number> {
    // This would get the current rotation count
    return 0
  }

  // Manual rotation endpoint
  async manualRotateSecret(secretId: string, userId: string): Promise<void> {
    const span = this.telemetryService.startSpan('manual_rotate_secret')
    
    try {
      span.setAttribute('secret_id', secretId)
      span.setAttribute('user_id', userId)

      const metadata = await this.getSecretMetadata(secretId)
      if (!metadata) {
        throw new Error(`Secret not found: ${secretId}`)
      }

      await this.rotateSecret(secretId, metadata.type)

      // Log manual rotation
      this.telemetryService.recordUserAction(userId, 'manual_secret_rotation', {
        secretId,
        secretType: metadata.type,
      })

      span.setStatus({ code: 0, message: 'Manual rotation completed' })
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Manual rotation failed' })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Get rotation statistics
  async getRotationStats(): Promise<any> {
    // This would return statistics about secret rotations
    return {
      totalSecrets: 0,
      secretsNeedingRotation: 0,
      secretsExpiringSoon: 0,
      lastRotationDate: null,
      averageRotationInterval: 0,
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Check if rotation service is working
      const stats = await this.getRotationStats()
      return true
    } catch (error) {
      console.error('Secrets rotation health check failed:', error)
      return false
    }
  }
}
