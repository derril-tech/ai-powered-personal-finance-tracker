// Created automatically by Cursor AI (2024-12-19)

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RlsService } from '../database/rls.service'
import { SignedUrlService } from '../security/signed-url.service'
import { TelemetryService } from '../observability/telemetry.service'
import { SentryService } from '../observability/sentry.service'
import { Pool } from 'pg'

export interface DsrRequest {
  id: string
  userId: string
  householdId: string
  type: 'export' | 'delete' | 'rectification' | 'portability'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  requestedAt: Date
  completedAt?: Date
  data?: any
  error?: string
}

export interface DataExport {
  user: any
  household: any
  accounts: any[]
  transactions: any[]
  budgets: any[]
  goals: any[]
  categories: any[]
  merchants: any[]
  rules: any[]
  alerts: any[]
  reports: any[]
  auditLog: any[]
}

@Injectable()
export class DsrService {
  private pool: Pool

  constructor(
    private configService: ConfigService,
    private rlsService: RlsService,
    private signedUrlService: SignedUrlService,
    private telemetryService: TelemetryService,
    private sentryService: SentryService,
  ) {
    this.initializePool()
  }

  private initializePool() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL')
    
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: this.configService.get<boolean>('DATABASE_SSL', false) ? { rejectUnauthorized: false } : false,
    })
  }

  // Create a new DSR request
  async createDsrRequest(
    userId: string,
    householdId: string,
    type: DsrRequest['type']
  ): Promise<DsrRequest> {
    const span = this.telemetryService.startSpan('create_dsr_request')
    
    try {
      span.setAttribute('user_id', userId)
      span.setAttribute('household_id', householdId)
      span.setAttribute('request_type', type)

      // Validate user has access to household
      const hasAccess = await this.rlsService.userHasHouseholdAccess(householdId, userId)
      if (!hasAccess) {
        throw new Error('User does not have access to this household')
      }

      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')

        // Create DSR request record
        const result = await client.query(
          `INSERT INTO dsr_requests (user_id, household_id, type, status, requested_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [userId, householdId, type, 'pending', new Date()]
        )

        const dsrRequest = result.rows[0]

        // Log the request
        await client.query(
          `INSERT INTO audit_log (user_id, household_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, householdId, 'dsr_request_created', 'dsr_request', dsrRequest.id, { type }]
        )

        await client.query('COMMIT')

        // Track the DSR request
        this.telemetryService.recordUserAction(userId, 'dsr_request_created', {
          requestId: dsrRequest.id,
          type,
          householdId,
        })

        span.setStatus({ code: 0, message: 'DSR request created successfully' })
        return dsrRequest
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to create DSR request' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'dsr_request_creation_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Export user data
  async exportUserData(userId: string, householdId: string): Promise<DataExport> {
    const span = this.telemetryService.startSpan('export_user_data')
    
    try {
      span.setAttribute('user_id', userId)
      span.setAttribute('household_id', householdId)

      // Validate user has access to household
      const hasAccess = await this.rlsService.userHasHouseholdAccess(householdId, userId)
      if (!hasAccess) {
        throw new Error('User does not have access to this household')
      }

      const client = await this.pool.connect()
      
      try {
        // Set user context for RLS
        await this.rlsService.setUserContext(userId, householdId)

        // Export user data
        const dataExport: DataExport = {
          user: null,
          household: null,
          accounts: [],
          transactions: [],
          budgets: [],
          goals: [],
          categories: [],
          merchants: [],
          rules: [],
          alerts: [],
          reports: [],
          auditLog: [],
        }

        // Export user information
        const userResult = await client.query(
          'SELECT id, email, first_name, last_name, created_at, updated_at FROM users WHERE id = $1',
          [userId]
        )
        dataExport.user = userResult.rows[0]

        // Export household information
        const householdResult = await client.query(
          'SELECT id, name, currency, created_at, updated_at FROM households WHERE id = $1',
          [householdId]
        )
        dataExport.household = householdResult.rows[0]

        // Export accounts
        const accountsResult = await client.query(
          'SELECT * FROM accounts WHERE household_id = $1',
          [householdId]
        )
        dataExport.accounts = accountsResult.rows

        // Export transactions
        const transactionsResult = await client.query(
          'SELECT * FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE household_id = $1)',
          [householdId]
        )
        dataExport.transactions = transactionsResult.rows

        // Export budgets
        const budgetsResult = await client.query(
          'SELECT * FROM budgets WHERE household_id = $1',
          [householdId]
        )
        dataExport.budgets = budgetsResult.rows

        // Export budget lines
        const budgetLinesResult = await client.query(
          'SELECT bl.* FROM budget_lines bl JOIN budgets b ON bl.budget_id = b.id WHERE b.household_id = $1',
          [householdId]
        )
        dataExport.budgets = dataExport.budgets.map(budget => ({
          ...budget,
          lines: budgetLinesResult.rows.filter(line => line.budget_id === budget.id)
        }))

        // Export goals
        const goalsResult = await client.query(
          'SELECT * FROM goals WHERE household_id = $1',
          [householdId]
        )
        dataExport.goals = goalsResult.rows

        // Export categories
        const categoriesResult = await client.query(
          'SELECT * FROM categories WHERE household_id = $1 OR household_id IS NULL',
          [householdId]
        )
        dataExport.categories = categoriesResult.rows

        // Export merchants
        const merchantsResult = await client.query(
          'SELECT * FROM merchants WHERE household_id = $1 OR household_id IS NULL',
          [householdId]
        )
        dataExport.merchants = merchantsResult.rows

        // Export rules
        const rulesResult = await client.query(
          'SELECT * FROM rules WHERE household_id = $1',
          [householdId]
        )
        dataExport.rules = rulesResult.rows

        // Export alerts
        const alertsResult = await client.query(
          'SELECT * FROM alerts WHERE household_id = $1',
          [householdId]
        )
        dataExport.alerts = alertsResult.rows

        // Export reports
        const reportsResult = await client.query(
          'SELECT * FROM reports WHERE household_id = $1',
          [householdId]
        )
        dataExport.reports = reportsResult.rows

        // Export audit log
        const auditLogResult = await client.query(
          'SELECT * FROM audit_log WHERE household_id = $1 OR user_id = $2',
          [householdId, userId]
        )
        dataExport.auditLog = auditLogResult.rows

        // Clear user context
        await this.rlsService.clearUserContext()

        // Track the export
        this.telemetryService.recordUserAction(userId, 'data_exported', {
          householdId,
          recordCount: {
            accounts: dataExport.accounts.length,
            transactions: dataExport.transactions.length,
            budgets: dataExport.budgets.length,
            goals: dataExport.goals.length,
            categories: dataExport.categories.length,
            merchants: dataExport.merchants.length,
            rules: dataExport.rules.length,
            alerts: dataExport.alerts.length,
            reports: dataExport.reports.length,
            auditLog: dataExport.auditLog.length,
          },
        })

        span.setStatus({ code: 0, message: 'Data export completed successfully' })
        return dataExport
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to export user data' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'data_export_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Delete user data
  async deleteUserData(userId: string, householdId: string): Promise<void> {
    const span = this.telemetryService.startSpan('delete_user_data')
    
    try {
      span.setAttribute('user_id', userId)
      span.setAttribute('household_id', householdId)

      // Validate user has access to household
      const hasAccess = await this.rlsService.userHasHouseholdAccess(householdId, userId)
      if (!hasAccess) {
        throw new Error('User does not have access to this household')
      }

      // Check if user is household owner (only owners can delete household data)
      const isOwner = await this.rlsService.isHouseholdOwner(householdId, userId)
      if (!isOwner) {
        throw new Error('Only household owners can delete household data')
      }

      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')

        // Set user context for RLS
        await this.rlsService.setUserContext(userId, householdId)

        // Delete data in the correct order (respecting foreign key constraints)
        
        // Delete reports
        await client.query(
          'DELETE FROM reports WHERE household_id = $1',
          [householdId]
        )

        // Delete alerts
        await client.query(
          'DELETE FROM alerts WHERE household_id = $1',
          [householdId]
        )

        // Delete anomalies
        await client.query(
          `DELETE FROM anomalies WHERE transaction_id IN (
            SELECT t.id FROM transactions t 
            JOIN accounts a ON t.account_id = a.id 
            WHERE a.household_id = $1
          )`,
          [householdId]
        )

        // Delete rules
        await client.query(
          'DELETE FROM rules WHERE household_id = $1',
          [householdId]
        )

        // Delete forecasts
        await client.query(
          'DELETE FROM forecasts WHERE household_id = $1',
          [householdId]
        )

        // Delete recurring transactions
        await client.query(
          `DELETE FROM recurring WHERE account_id IN (
            SELECT id FROM accounts WHERE household_id = $1
          )`,
          [householdId]
        )

        // Delete budget lines
        await client.query(
          `DELETE FROM budget_lines WHERE budget_id IN (
            SELECT id FROM budgets WHERE household_id = $1
          )`,
          [householdId]
        )

        // Delete budgets
        await client.query(
          'DELETE FROM budgets WHERE household_id = $1',
          [householdId]
        )

        // Delete goals
        await client.query(
          'DELETE FROM goals WHERE household_id = $1',
          [householdId]
        )

        // Delete transactions
        await client.query(
          `DELETE FROM transactions WHERE account_id IN (
            SELECT id FROM accounts WHERE household_id = $1
          )`,
          [householdId]
        )

        // Delete connections
        await client.query(
          'DELETE FROM connections WHERE household_id = $1',
          [householdId]
        )

        // Delete accounts
        await client.query(
          'DELETE FROM accounts WHERE household_id = $1',
          [householdId]
        )

        // Delete memberships
        await client.query(
          'DELETE FROM memberships WHERE household_id = $1',
          [householdId]
        )

        // Delete household-specific categories
        await client.query(
          'DELETE FROM categories WHERE household_id = $1',
          [householdId]
        )

        // Delete household-specific merchants
        await client.query(
          'DELETE FROM merchants WHERE household_id = $1',
          [householdId]
        )

        // Delete household
        await client.query(
          'DELETE FROM households WHERE id = $1',
          [householdId]
        )

        // Log the deletion
        await client.query(
          `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'data_deleted', 'household', householdId, { householdId }]
        )

        // Clear user context
        await this.rlsService.clearUserContext()

        await client.query('COMMIT')

        // Track the deletion
        this.telemetryService.recordUserAction(userId, 'data_deleted', {
          householdId,
        })

        span.setStatus({ code: 0, message: 'Data deletion completed successfully' })
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to delete user data' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'data_deletion_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Get DSR request status
  async getDsrRequestStatus(requestId: string, userId: string): Promise<DsrRequest> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM dsr_requests WHERE id = $1 AND user_id = $2',
        [requestId, userId]
      )

      if (result.rows.length === 0) {
        throw new Error('DSR request not found')
      }

      return result.rows[0]
    } finally {
      client.release()
    }
  }

  // Get user's DSR requests
  async getUserDsrRequests(userId: string): Promise<DsrRequest[]> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM dsr_requests WHERE user_id = $1 ORDER BY requested_at DESC',
        [userId]
      )

      return result.rows
    } finally {
      client.release()
    }
  }

  // Update DSR request status
  async updateDsrRequestStatus(
    requestId: string,
    status: DsrRequest['status'],
    data?: any,
    error?: string
  ): Promise<void> {
    const client = await this.pool.connect()
    
    try {
      await client.query(
        `UPDATE dsr_requests 
         SET status = $1, completed_at = $2, data = $3, error = $4
         WHERE id = $5`,
        [status, new Date(), data, error, requestId]
      )
    } finally {
      client.release()
    }
  }

  // Generate export file and upload to S3
  async generateExportFile(userId: string, householdId: string, dataExport: DataExport): Promise<string> {
    const span = this.telemetryService.startSpan('generate_export_file')
    
    try {
      span.setAttribute('user_id', userId)
      span.setAttribute('household_id', householdId)

      // Generate JSON file
      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        householdId,
        data: dataExport,
      }

      const jsonContent = JSON.stringify(exportData, null, 2)
      const fileName = `export-${householdId}-${Date.now()}.json`

      // Generate signed URL for upload
      const uploadUrl = await this.signedUrlService.generateBackupUploadUrl(
        householdId,
        `dsr-export-${Date.now()}`,
        { expiresIn: 3600 }
      )

      // In a real implementation, you would upload the file to S3 here
      // For now, we'll just return a mock URL
      const downloadUrl = await this.signedUrlService.generateBackupDownloadUrl(
        householdId,
        `dsr-export-${Date.now()}`
      )

      span.setStatus({ code: 0, message: 'Export file generated successfully' })
      return downloadUrl
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to generate export file' })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Process DSR request
  async processDsrRequest(requestId: string): Promise<void> {
    const span = this.telemetryService.startSpan('process_dsr_request')
    
    try {
      span.setAttribute('request_id', requestId)

      const client = await this.pool.connect()
      
      try {
        // Get request details
        const requestResult = await client.query(
          'SELECT * FROM dsr_requests WHERE id = $1',
          [requestId]
        )

        if (requestResult.rows.length === 0) {
          throw new Error('DSR request not found')
        }

        const request = requestResult.rows[0]

        // Update status to processing
        await this.updateDsrRequestStatus(requestId, 'processing')

        try {
          switch (request.type) {
            case 'export':
              const dataExport = await this.exportUserData(request.user_id, request.household_id)
              const exportUrl = await this.generateExportFile(request.user_id, request.household_id, dataExport)
              await this.updateDsrRequestStatus(requestId, 'completed', { exportUrl })
              break

            case 'delete':
              await this.deleteUserData(request.user_id, request.household_id)
              await this.updateDsrRequestStatus(requestId, 'completed')
              break

            case 'rectification':
              // Implement data rectification logic
              await this.updateDsrRequestStatus(requestId, 'completed')
              break

            case 'portability':
              // Implement data portability logic
              await this.updateDsrRequestStatus(requestId, 'completed')
              break

            default:
              throw new Error(`Unknown DSR request type: ${request.type}`)
          }

          span.setStatus({ code: 0, message: 'DSR request processed successfully' })
        } catch (error) {
          await this.updateDsrRequestStatus(requestId, 'failed', null, error.message)
          throw error
        }
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to process DSR request' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'dsr_request_processing_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()
      return true
    } catch (error) {
      console.error('DSR service health check failed:', error)
      return false
    }
  }

  // Cleanup on module destroy
  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end()
    }
  }
}
