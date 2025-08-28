// Created automatically by Cursor AI (2024-12-19)

import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms'

export interface EncryptedData {
  encryptedData: string
  encryptedKey: string
  keyId: string
  algorithm: string
}

@Injectable()
export class KmsService implements OnModuleInit {
  private kmsClient: KMSClient
  private keyId: string
  private isEnabled: boolean

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeKms()
  }

  private async initializeKms() {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1')
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID')
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
    this.keyId = this.configService.get<string>('KMS_KEY_ID', '')
    this.isEnabled = this.configService.get<boolean>('ENABLE_KMS', false)

    if (!this.isEnabled || !this.keyId) {
      console.log('KMS disabled or no key ID configured')
      return
    }

    this.kmsClient = new KMSClient({
      region,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
    })

    console.log('KMS client initialized')
  }

  async encrypt(data: string, context?: Record<string, string>): Promise<EncryptedData> {
    if (!this.isEnabled || !this.kmsClient) {
      // Fallback to environment-based encryption or return as-is for development
      return {
        encryptedData: Buffer.from(data).toString('base64'),
        encryptedKey: '',
        keyId: 'local',
        algorithm: 'base64',
      }
    }

    try {
      // Generate a data key
      const generateKeyCommand = new GenerateDataKeyCommand({
        KeyId: this.keyId,
        KeySpec: 'AES_256',
        EncryptionContext: context,
      })

      const generateKeyResponse = await this.kmsClient.send(generateKeyCommand)
      
      if (!generateKeyResponse.Plaintext || !generateKeyResponse.CiphertextBlob) {
        throw new Error('Failed to generate data key')
      }

      // Encrypt the data with the plaintext key
      const crypto = require('crypto')
      const algorithm = 'aes-256-gcm'
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipher(algorithm, generateKeyResponse.Plaintext)
      
      let encrypted = cipher.update(data, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const authTag = cipher.getAuthTag()

      // Combine IV, encrypted data, and auth tag
      const encryptedData = Buffer.concat([
        iv,
        Buffer.from(encrypted, 'hex'),
        authTag
      ]).toString('base64')

      return {
        encryptedData,
        encryptedKey: generateKeyResponse.CiphertextBlob.toString('base64'),
        keyId: this.keyId,
        algorithm,
      }
    } catch (error) {
      console.error('KMS encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  async decrypt(encryptedData: EncryptedData, context?: Record<string, string>): Promise<string> {
    if (!this.isEnabled || !this.kmsClient) {
      // Fallback for development
      if (encryptedData.algorithm === 'base64') {
        return Buffer.from(encryptedData.encryptedData, 'base64').toString('utf8')
      }
      throw new Error('KMS not enabled')
    }

    try {
      // Decrypt the data key
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedData.encryptedKey, 'base64'),
        EncryptionContext: context,
      })

      const decryptResponse = await this.kmsClient.send(decryptCommand)
      
      if (!decryptResponse.Plaintext) {
        throw new Error('Failed to decrypt data key')
      }

      // Decrypt the data with the plaintext key
      const crypto = require('crypto')
      const algorithm = 'aes-256-gcm'
      
      const encryptedBuffer = Buffer.from(encryptedData.encryptedData, 'base64')
      const iv = encryptedBuffer.subarray(0, 16)
      const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16)
      const encrypted = encryptedBuffer.subarray(16, encryptedBuffer.length - 16)

      const decipher = crypto.createDecipher(algorithm, decryptResponse.Plaintext)
      decipher.setAuthTag(authTag)
      
      let decrypted = decipher.update(encrypted, null, 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      console.error('KMS decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  async encryptConnectorToken(provider: string, accountId: string, token: string): Promise<EncryptedData> {
    const context = {
      'provider': provider,
      'account_id': accountId,
      'purpose': 'connector_token',
    }
    
    return this.encrypt(token, context)
  }

  async decryptConnectorToken(provider: string, accountId: string, encryptedData: EncryptedData): Promise<string> {
    const context = {
      'provider': provider,
      'account_id': accountId,
      'purpose': 'connector_token',
    }
    
    return this.decrypt(encryptedData, context)
  }

  async encryptApiKey(apiKey: string, userId: string): Promise<EncryptedData> {
    const context = {
      'user_id': userId,
      'purpose': 'api_key',
    }
    
    return this.encrypt(apiKey, context)
  }

  async decryptApiKey(encryptedData: EncryptedData, userId: string): Promise<string> {
    const context = {
      'user_id': userId,
      'purpose': 'api_key',
    }
    
    return this.decrypt(encryptedData, context)
  }

  async encryptWebhookSecret(secret: string, organizationId: string): Promise<EncryptedData> {
    const context = {
      'organization_id': organizationId,
      'purpose': 'webhook_secret',
    }
    
    return this.encrypt(secret, context)
  }

  async decryptWebhookSecret(encryptedData: EncryptedData, organizationId: string): Promise<string> {
    const context = {
      'organization_id': organizationId,
      'purpose': 'webhook_secret',
    }
    
    return this.decrypt(encryptedData, context)
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    if (!this.isEnabled) {
      return true // KMS is optional
    }

    try {
      // Try to generate a small data key to test connectivity
      const command = new GenerateDataKeyCommand({
        KeyId: this.keyId,
        KeySpec: 'AES_256',
        NumberOfBytes: 32,
      })
      
      await this.kmsClient.send(command)
      return true
    } catch (error) {
      console.error('KMS health check failed:', error)
      return false
    }
  }
}
