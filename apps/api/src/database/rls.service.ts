// Created automatically by Cursor AI (2024-12-19)

import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'

export interface UserContext {
  userId: string
  organizationId: string
}

@Injectable()
export class RlsService implements OnModuleInit {
  private pool: Pool

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializePool()
  }

  private async initializePool() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL')
    
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: this.configService.get<boolean>('DATABASE_SSL', false) ? { rejectUnauthorized: false } : false,
    })

    console.log('RLS service pool initialized')
  }

  // Set user context for the current database session
  async setUserContext(userId: string, organizationId: string): Promise<void> {
    const client = await this.pool.connect()
    
    try {
      await client.query('SELECT set_user_context($1, $2)', [userId, organizationId])
    } finally {
      client.release()
    }
  }

  // Clear user context
  async clearUserContext(): Promise<void> {
    const client = await this.pool.connect()
    
    try {
      await client.query('SELECT clear_user_context()')
    } finally {
      client.release()
    }
  }

  // Check if user has access to a specific account
  async userHasAccountAccess(accountId: string, userId: string): Promise<boolean> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT user_has_account_access($1, $2)',
        [accountId, userId]
      )
      return result.rows[0].user_has_account_access
    } finally {
      client.release()
    }
  }

  // Check if user has access to a specific household
  async userHasHouseholdAccess(householdId: string, userId: string): Promise<boolean> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT user_has_household_access($1, $2)',
        [householdId, userId]
      )
      return result.rows[0].user_has_household_access
    } finally {
      client.release()
    }
  }

  // Get all household IDs that a user has access to
  async getUserHouseholdIds(userId: string): Promise<string[]> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT get_user_household_ids($1)',
        [userId]
      )
      return result.rows[0].get_user_household_ids || []
    } finally {
      client.release()
    }
  }

  // Get all account IDs that a user has access to
  async getUserAccountIds(userId: string): Promise<string[]> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT get_user_account_ids($1)',
        [userId]
      )
      return result.rows[0].get_user_account_ids || []
    } finally {
      client.release()
    }
  }

  // Validate user permissions for household operations
  async validateHouseholdPermission(
    householdId: string,
    userId: string,
    requiredRole: 'owner' | 'admin' | 'member' | 'viewer' = 'member'
  ): Promise<boolean> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT validate_household_permission($1, $2, $3)',
        [householdId, userId, requiredRole]
      )
      return result.rows[0].validate_household_permission
    } finally {
      client.release()
    }
  }

  // Get user's role in a specific household
  async getUserHouseholdRole(householdId: string, userId: string): Promise<string> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT get_user_household_role($1, $2)',
        [householdId, userId]
      )
      return result.rows[0].get_user_household_role
    } finally {
      client.release()
    }
  }

  // Check if user can modify household data
  async canModifyHouseholdData(householdId: string, userId: string): Promise<boolean> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT can_modify_household_data($1, $2)',
        [householdId, userId]
      )
      return result.rows[0].can_modify_household_data
    } finally {
      client.release()
    }
  }

  // Check if user can view household data
  async canViewHouseholdData(householdId: string, userId: string): Promise<boolean> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT can_view_household_data($1, $2)',
        [householdId, userId]
      )
      return result.rows[0].can_view_household_data
    } finally {
      client.release()
    }
  }

  // Check if user can manage household settings
  async canManageHouseholdSettings(householdId: string, userId: string): Promise<boolean> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT can_manage_household_settings($1, $2)',
        [householdId, userId]
      )
      return result.rows[0].can_manage_household_settings
    } finally {
      client.release()
    }
  }

  // Check if user owns the household
  async isHouseholdOwner(householdId: string, userId: string): Promise<boolean> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT is_household_owner($1, $2)',
        [householdId, userId]
      )
      return result.rows[0].is_household_owner
    } finally {
      client.release()
    }
  }

  // Execute a query with user context
  async executeWithContext<T>(
    userId: string,
    organizationId: string,
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    const client = await this.pool.connect()
    
    try {
      // Set user context
      await client.query('SELECT set_user_context($1, $2)', [userId, organizationId])
      
      // Execute the query
      const result = await client.query(query, params)
      
      return result.rows
    } finally {
      // Clear user context
      await client.query('SELECT clear_user_context()')
      client.release()
    }
  }

  // Execute a transaction with user context
  async executeTransactionWithContext<T>(
    userId: string,
    organizationId: string,
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // Set user context
      await client.query('SELECT set_user_context($1, $2)', [userId, organizationId])
      
      // Execute the transaction
      const result = await callback(client)
      
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      // Clear user context
      await client.query('SELECT clear_user_context()')
      client.release()
    }
  }

  // Get user's permissions for a specific resource
  async getUserPermissions(userId: string, resourceType: string, resourceId: string): Promise<any> {
    switch (resourceType) {
      case 'household':
        const householdRole = await this.getUserHouseholdRole(resourceId, userId)
        return {
          canView: await this.canViewHouseholdData(resourceId, userId),
          canModify: await this.canModifyHouseholdData(resourceId, userId),
          canManage: await this.canManageHouseholdSettings(resourceId, userId),
          isOwner: await this.isHouseholdOwner(resourceId, userId),
          role: householdRole,
        }
      
      case 'account':
        const hasAccountAccess = await this.userHasAccountAccess(resourceId, userId)
        return {
          canView: hasAccountAccess,
          canModify: hasAccountAccess,
          canDelete: false, // Account deletion requires household admin permissions
        }
      
      default:
        return {
          canView: false,
          canModify: false,
          canDelete: false,
        }
    }
  }

  // Validate access to multiple resources
  async validateBulkAccess(
    userId: string,
    resources: Array<{ type: string; id: string; requiredPermission: string }>
  ): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {}
    
    for (const resource of resources) {
      const key = `${resource.type}:${resource.id}`
      
      switch (resource.type) {
        case 'household':
          switch (resource.requiredPermission) {
            case 'view':
              results[key] = await this.canViewHouseholdData(resource.id, userId)
              break
            case 'modify':
              results[key] = await this.canModifyHouseholdData(resource.id, userId)
              break
            case 'manage':
              results[key] = await this.canManageHouseholdSettings(resource.id, userId)
              break
            case 'owner':
              results[key] = await this.isHouseholdOwner(resource.id, userId)
              break
            default:
              results[key] = false
          }
          break
        
        case 'account':
          results[key] = await this.userHasAccountAccess(resource.id, userId)
          break
        
        default:
          results[key] = false
      }
    }
    
    return results
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()
      return true
    } catch (error) {
      console.error('RLS service health check failed:', error)
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
