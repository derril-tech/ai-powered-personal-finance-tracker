// Created automatically by Cursor AI (2024-12-19)

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHash } from 'crypto'

export interface SignedUrlOptions {
  expiresIn?: number // seconds, default 3600 (1 hour)
  contentType?: string
  metadata?: Record<string, string>
  responseDisposition?: string
  responseContentType?: string
}

export interface UploadUrlResponse {
  uploadUrl: string
  key: string
  fields: Record<string, string>
  expiresAt: Date
}

@Injectable()
export class SignedUrlService {
  private s3Client: S3Client
  private bucketName: string
  private region: string

  constructor(private configService: ConfigService) {
    this.initializeS3()
  }

  private initializeS3() {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1')
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID')
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME', '')
    this.region = region

    if (!this.bucketName) {
      console.log('S3 bucket name not configured')
      return
    }

    this.s3Client = new S3Client({
      region,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
    })

    console.log('S3 client initialized for signed URLs')
  }

  // Generate a signed URL for downloading/reading an object
  async generateDownloadUrl(
    key: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized')
    }

    const {
      expiresIn = 3600,
      responseDisposition,
      responseContentType,
    } = options

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: responseDisposition,
      ResponseContentType: responseContentType,
    })

    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      })

      return signedUrl
    } catch (error) {
      console.error('Failed to generate download URL:', error)
      throw new Error('Failed to generate download URL')
    }
  }

  // Generate a signed URL for uploading an object
  async generateUploadUrl(
    key: string,
    options: SignedUrlOptions = {}
  ): Promise<UploadUrlResponse> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized')
    }

    const {
      expiresIn = 3600,
      contentType = 'application/octet-stream',
      metadata = {},
    } = options

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
    })

    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      })

      const expiresAt = new Date(Date.now() + expiresIn * 1000)

      return {
        uploadUrl: signedUrl,
        key,
        fields: {
          'Content-Type': contentType,
          ...metadata,
        },
        expiresAt,
      }
    } catch (error) {
      console.error('Failed to generate upload URL:', error)
      throw new Error('Failed to generate upload URL')
    }
    }

  // Generate a signed URL for deleting an object
  async generateDeleteUrl(
    key: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized')
    }

    const { expiresIn = 3600 } = options

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      })

      return signedUrl
    } catch (error) {
      console.error('Failed to generate delete URL:', error)
      throw new Error('Failed to generate delete URL')
    }
  }

  // Generate a signed URL for a report file
  async generateReportDownloadUrl(
    householdId: string,
    reportId: string,
    format: 'pdf' | 'csv' | 'xlsx',
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const key = `reports/${householdId}/${reportId}.${format}`
    
    const responseDisposition = `attachment; filename="report-${reportId}.${format}"`
    const responseContentType = this.getContentType(format)

    return this.generateDownloadUrl(key, {
      ...options,
      responseDisposition,
      responseContentType,
    })
  }

  // Generate a signed URL for a statement file
  async generateStatementDownloadUrl(
    householdId: string,
    accountId: string,
    statementId: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const key = `statements/${householdId}/${accountId}/${statementId}.pdf`
    
    const responseDisposition = `attachment; filename="statement-${statementId}.pdf"`
    const responseContentType = 'application/pdf'

    return this.generateDownloadUrl(key, {
      ...options,
      responseDisposition,
      responseContentType,
    })
  }

  // Generate a signed URL for an export bundle
  async generateExportDownloadUrl(
    householdId: string,
    exportId: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const key = `exports/${householdId}/${exportId}.zip`
    
    const responseDisposition = `attachment; filename="export-${exportId}.zip"`
    const responseContentType = 'application/zip'

    return this.generateDownloadUrl(key, {
      ...options,
      responseDisposition,
      responseContentType,
    })
  }

  // Generate a signed URL for uploading a statement
  async generateStatementUploadUrl(
    householdId: string,
    accountId: string,
    fileName: string,
    options: SignedUrlOptions = {}
  ): Promise<UploadUrlResponse> {
    const key = `statements/${householdId}/${accountId}/${fileName}`
    
    return this.generateUploadUrl(key, {
      ...options,
      contentType: 'application/pdf',
      metadata: {
        householdId,
        accountId,
        uploadedAt: new Date().toISOString(),
      },
    })
  }

  // Generate a signed URL for uploading an import file
  async generateImportUploadUrl(
    householdId: string,
    importId: string,
    fileName: string,
    options: SignedUrlOptions = {}
  ): Promise<UploadUrlResponse> {
    const key = `imports/${householdId}/${importId}/${fileName}`
    
    return this.generateUploadUrl(key, {
      ...options,
      metadata: {
        householdId,
        importId,
        uploadedAt: new Date().toISOString(),
      },
    })
  }

  // Generate a signed URL for a shared report (public read-only)
  async generateSharedReportUrl(
    shareId: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const key = `shared/${shareId}/report.pdf`
    
    // Shared reports have longer expiry (30 days)
    const expiresIn = options.expiresIn || 30 * 24 * 60 * 60
    
    return this.generateDownloadUrl(key, {
      ...options,
      expiresIn,
      responseContentType: 'application/pdf',
    })
  }

  // Generate a signed URL for a profile picture
  async generateProfilePictureUrl(
    userId: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const key = `profiles/${userId}/avatar.jpg`
    
    return this.generateDownloadUrl(key, {
      ...options,
      responseContentType: 'image/jpeg',
    })
  }

  // Generate a signed URL for uploading a profile picture
  async generateProfilePictureUploadUrl(
    userId: string,
    options: SignedUrlOptions = {}
  ): Promise<UploadUrlResponse> {
    const key = `profiles/${userId}/avatar.jpg`
    
    return this.generateUploadUrl(key, {
      ...options,
      contentType: 'image/jpeg',
      metadata: {
        userId,
        uploadedAt: new Date().toISOString(),
      },
    })
  }

  // Generate a signed URL for a backup file
  async generateBackupDownloadUrl(
    householdId: string,
    backupId: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const key = `backups/${householdId}/${backupId}.json`
    
    const responseDisposition = `attachment; filename="backup-${backupId}.json"`
    const responseContentType = 'application/json'

    return this.generateDownloadUrl(key, {
      ...options,
      responseDisposition,
      responseContentType,
    })
  }

  // Generate a signed URL for uploading a backup
  async generateBackupUploadUrl(
    householdId: string,
    backupId: string,
    options: SignedUrlOptions = {}
  ): Promise<UploadUrlResponse> {
    const key = `backups/${householdId}/${backupId}.json`
    
    return this.generateUploadUrl(key, {
      ...options,
      contentType: 'application/json',
      metadata: {
        householdId,
        backupId,
        uploadedAt: new Date().toISOString(),
      },
    })
  }

  // Generate a signed URL for a temporary file (short expiry)
  async generateTemporaryUrl(
    key: string,
    operation: 'get' | 'put' | 'delete',
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const expiresIn = options.expiresIn || 300 // 5 minutes for temporary files

    switch (operation) {
      case 'get':
        return this.generateDownloadUrl(key, { ...options, expiresIn })
      case 'put':
        const uploadResponse = await this.generateUploadUrl(key, { ...options, expiresIn })
        return uploadResponse.uploadUrl
      case 'delete':
        return this.generateDeleteUrl(key, { ...options, expiresIn })
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  // Generate a signed URL with custom prefix for organization isolation
  async generateOrganizationUrl(
    organizationId: string,
    key: string,
    operation: 'get' | 'put' | 'delete',
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const prefixedKey = `orgs/${organizationId}/${key}`
    
    switch (operation) {
      case 'get':
        return this.generateDownloadUrl(prefixedKey, options)
      case 'put':
        const uploadResponse = await this.generateUploadUrl(prefixedKey, options)
        return uploadResponse.uploadUrl
      case 'delete':
        return this.generateDeleteUrl(prefixedKey, options)
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  // Generate a signed URL with hash verification
  async generateVerifiedUrl(
    key: string,
    expectedHash: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    // Add hash to metadata for verification
    const metadata = {
      ...options.metadata,
      'x-expected-hash': expectedHash,
    }

    return this.generateDownloadUrl(key, {
      ...options,
      metadata,
    })
  }

  // Get content type for file format
  private getContentType(format: string): string {
    switch (format.toLowerCase()) {
      case 'pdf':
        return 'application/pdf'
      case 'csv':
        return 'text/csv'
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      case 'json':
        return 'application/json'
      case 'zip':
        return 'application/zip'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'png':
        return 'image/png'
      default:
        return 'application/octet-stream'
    }
  }

  // Validate a signed URL (check if it's still valid)
  async validateSignedUrl(url: string): Promise<boolean> {
    try {
      // Extract expiration from URL
      const urlObj = new URL(url)
      const expires = urlObj.searchParams.get('X-Amz-Date')
      
      if (!expires) {
        return false
      }

      // Parse the expiration time
      const expirationTime = new Date(expires)
      const now = new Date()

      return expirationTime > now
    } catch (error) {
      console.error('Failed to validate signed URL:', error)
      return false
    }
  }

  // Generate a hash for file verification
  generateFileHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex')
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.s3Client) {
        return false
      }

      // Try to generate a test URL to verify S3 connectivity
      const testKey = 'health-check/test.txt'
      await this.generateDownloadUrl(testKey, { expiresIn: 60 })
      
      return true
    } catch (error) {
      console.error('Signed URL service health check failed:', error)
      return false
    }
  }
}
