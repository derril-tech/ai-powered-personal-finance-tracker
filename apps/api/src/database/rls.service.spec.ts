// Created automatically by Cursor AI (2024-12-19)

import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { RlsService } from './rls.service'
import { Pool } from 'pg'

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn(),
}))

describe('RlsService', () => {
  let service: RlsService
  let mockPool: jest.Mocked<Pool>
  let mockClient: any

  const mockConfigService = {
    get: jest.fn(),
  }

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    }

    // Mock pool
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn(),
    } as any

    ;(Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool)

    // Mock config
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'DATABASE_URL':
          return 'postgresql://test:test@localhost:5432/test'
        case 'DATABASE_SSL':
          return false
        default:
          return undefined
      }
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RlsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<RlsService>(RlsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('onModuleInit', () => {
    it('should initialize pool with correct configuration', async () => {
      await service.onModuleInit()

      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://test:test@localhost:5432/test',
        ssl: false,
      })
    })

    it('should initialize pool with SSL when configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'DATABASE_URL':
            return 'postgresql://test:test@localhost:5432/test'
          case 'DATABASE_SSL':
            return true
          default:
            return undefined
        }
      })

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RlsService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile()

      const sslService = module.get<RlsService>(RlsService)
      await sslService.onModuleInit()

      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://test:test@localhost:5432/test',
        ssl: { rejectUnauthorized: false },
      })
    })
  })

  describe('setUserContext', () => {
    it('should set user context correctly', async () => {
      const userId = 'user-123'
      const organizationId = 'org-456'

      mockClient.query.mockResolvedValue({ rows: [] })

      await service.setUserContext(userId, organizationId)

      expect(mockPool.connect).toHaveBeenCalled()
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT set_user_context($1, $2)',
        [userId, organizationId]
      )
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('should release client even if query fails', async () => {
      const userId = 'user-123'
      const organizationId = 'org-456'

      mockClient.query.mockRejectedValue(new Error('Database error'))

      await expect(service.setUserContext(userId, organizationId)).rejects.toThrow('Database error')

      expect(mockClient.release).toHaveBeenCalled()
    })
  })

  describe('clearUserContext', () => {
    it('should clear user context correctly', async () => {
      mockClient.query.mockResolvedValue({ rows: [] })

      await service.clearUserContext()

      expect(mockPool.connect).toHaveBeenCalled()
      expect(mockClient.query).toHaveBeenCalledWith('SELECT clear_user_context()')
      expect(mockClient.release).toHaveBeenCalled()
    })
  })

  describe('userHasAccountAccess', () => {
    it('should return true when user has account access', async () => {
      const accountId = 'account-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ user_has_account_access: true }],
      })

      const result = await service.userHasAccountAccess(accountId, userId)

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT user_has_account_access($1, $2)',
        [accountId, userId]
      )
    })

    it('should return false when user does not have account access', async () => {
      const accountId = 'account-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ user_has_account_access: false }],
      })

      const result = await service.userHasAccountAccess(accountId, userId)

      expect(result).toBe(false)
    })
  })

  describe('userHasHouseholdAccess', () => {
    it('should return true when user has household access', async () => {
      const householdId = 'household-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ user_has_household_access: true }],
      })

      const result = await service.userHasHouseholdAccess(householdId, userId)

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT user_has_household_access($1, $2)',
        [householdId, userId]
      )
    })
  })

  describe('getUserHouseholdIds', () => {
    it('should return user household IDs', async () => {
      const userId = 'user-123'
      const householdIds = ['household-1', 'household-2']

      mockClient.query.mockResolvedValue({
        rows: [{ get_user_household_ids: householdIds }],
      })

      const result = await service.getUserHouseholdIds(userId)

      expect(result).toEqual(householdIds)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT get_user_household_ids($1)',
        [userId]
      )
    })

    it('should return empty array when no households found', async () => {
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ get_user_household_ids: null }],
      })

      const result = await service.getUserHouseholdIds(userId)

      expect(result).toEqual([])
    })
  })

  describe('getUserAccountIds', () => {
    it('should return user account IDs', async () => {
      const userId = 'user-123'
      const accountIds = ['account-1', 'account-2']

      mockClient.query.mockResolvedValue({
        rows: [{ get_user_account_ids: accountIds }],
      })

      const result = await service.getUserAccountIds(userId)

      expect(result).toEqual(accountIds)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT get_user_account_ids($1)',
        [userId]
      )
    })
  })

  describe('validateHouseholdPermission', () => {
    it('should validate owner permission correctly', async () => {
      const householdId = 'household-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ validate_household_permission: true }],
      })

      const result = await service.validateHouseholdPermission(householdId, userId, 'owner')

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT validate_household_permission($1, $2, $3)',
        [householdId, userId, 'owner']
      )
    })

    it('should use member as default required role', async () => {
      const householdId = 'household-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ validate_household_permission: true }],
      })

      await service.validateHouseholdPermission(householdId, userId)

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT validate_household_permission($1, $2, $3)',
        [householdId, userId, 'member']
      )
    })
  })

  describe('getUserHouseholdRole', () => {
    it('should return user role in household', async () => {
      const householdId = 'household-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ get_user_household_role: 'admin' }],
      })

      const result = await service.getUserHouseholdRole(householdId, userId)

      expect(result).toBe('admin')
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT get_user_household_role($1, $2)',
        [householdId, userId]
      )
    })

    it('should return none when user has no role', async () => {
      const householdId = 'household-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ get_user_household_role: 'none' }],
      })

      const result = await service.getUserHouseholdRole(householdId, userId)

      expect(result).toBe('none')
    })
  })

  describe('canModifyHouseholdData', () => {
    it('should return true when user can modify household data', async () => {
      const householdId = 'household-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ can_modify_household_data: true }],
      })

      const result = await service.canModifyHouseholdData(householdId, userId)

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT can_modify_household_data($1, $2)',
        [householdId, userId]
      )
    })
  })

  describe('canViewHouseholdData', () => {
    it('should return true when user can view household data', async () => {
      const householdId = 'household-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ can_view_household_data: true }],
      })

      const result = await service.canViewHouseholdData(householdId, userId)

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT can_view_household_data($1, $2)',
        [householdId, userId]
      )
    })
  })

  describe('canManageHouseholdSettings', () => {
    it('should return true when user can manage household settings', async () => {
      const householdId = 'household-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ can_manage_household_settings: true }],
      })

      const result = await service.canManageHouseholdSettings(householdId, userId)

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT can_manage_household_settings($1, $2)',
        [householdId, userId]
      )
    })
  })

  describe('isHouseholdOwner', () => {
    it('should return true when user is household owner', async () => {
      const householdId = 'household-123'
      const userId = 'user-123'

      mockClient.query.mockResolvedValue({
        rows: [{ is_household_owner: true }],
      })

      const result = await service.isHouseholdOwner(householdId, userId)

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT is_household_owner($1, $2)',
        [householdId, userId]
      )
    })
  })

  describe('executeWithContext', () => {
    it('should execute query with user context', async () => {
      const userId = 'user-123'
      const organizationId = 'org-456'
      const query = 'SELECT * FROM transactions'
      const params = ['param1']

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // set_user_context
        .mockResolvedValueOnce({ rows: [{ id: 1, amount: 100 }] }) // main query
        .mockResolvedValueOnce({ rows: [] }) // clear_user_context

      const result = await service.executeWithContext(userId, organizationId, query, params)

      expect(result).toEqual([{ id: 1, amount: 100 }])
      expect(mockClient.query).toHaveBeenCalledTimes(3)
      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'SELECT set_user_context($1, $2)', [userId, organizationId])
      expect(mockClient.query).toHaveBeenNthCalledWith(2, query, params)
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'SELECT clear_user_context()')
    })

    it('should clear context even if query fails', async () => {
      const userId = 'user-123'
      const organizationId = 'org-456'
      const query = 'SELECT * FROM transactions'

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // set_user_context
        .mockRejectedValueOnce(new Error('Query failed')) // main query
        .mockResolvedValueOnce({ rows: [] }) // clear_user_context

      await expect(service.executeWithContext(userId, organizationId, query)).rejects.toThrow('Query failed')

      expect(mockClient.query).toHaveBeenCalledTimes(3)
      expect(mockClient.query).toHaveBeenLastCalledWith('SELECT clear_user_context()')
    })
  })

  describe('executeTransactionWithContext', () => {
    it('should execute transaction with user context', async () => {
      const userId = 'user-123'
      const organizationId = 'org-456'
      const callback = jest.fn().mockResolvedValue('transaction result')

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // set_user_context
        .mockResolvedValueOnce({ rows: [] }) // COMMIT
        .mockResolvedValueOnce({ rows: [] }) // clear_user_context

      const result = await service.executeTransactionWithContext(userId, organizationId, callback)

      expect(result).toBe('transaction result')
      expect(callback).toHaveBeenCalledWith(mockClient)
      expect(mockClient.query).toHaveBeenCalledTimes(4)
      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN')
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'SELECT set_user_context($1, $2)', [userId, organizationId])
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'COMMIT')
      expect(mockClient.query).toHaveBeenNthCalledWith(4, 'SELECT clear_user_context()')
    })

    it('should rollback transaction on error', async () => {
      const userId = 'user-123'
      const organizationId = 'org-456'
      const callback = jest.fn().mockRejectedValue(new Error('Transaction failed'))

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // set_user_context
        .mockResolvedValueOnce({ rows: [] }) // ROLLBACK
        .mockResolvedValueOnce({ rows: [] }) // clear_user_context

      await expect(service.executeTransactionWithContext(userId, organizationId, callback)).rejects.toThrow('Transaction failed')

      expect(mockClient.query).toHaveBeenCalledTimes(4)
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'ROLLBACK')
    })
  })

  describe('getUserPermissions', () => {
    it('should return household permissions correctly', async () => {
      const userId = 'user-123'
      const householdId = 'household-123'

      // Mock all the permission checks
      jest.spyOn(service, 'getUserHouseholdRole').mockResolvedValue('admin')
      jest.spyOn(service, 'canViewHouseholdData').mockResolvedValue(true)
      jest.spyOn(service, 'canModifyHouseholdData').mockResolvedValue(true)
      jest.spyOn(service, 'canManageHouseholdSettings').mockResolvedValue(true)
      jest.spyOn(service, 'isHouseholdOwner').mockResolvedValue(false)

      const result = await service.getUserPermissions(userId, 'household', householdId)

      expect(result).toEqual({
        canView: true,
        canModify: true,
        canManage: true,
        isOwner: false,
        role: 'admin',
      })
    })

    it('should return account permissions correctly', async () => {
      const userId = 'user-123'
      const accountId = 'account-123'

      jest.spyOn(service, 'userHasAccountAccess').mockResolvedValue(true)

      const result = await service.getUserPermissions(userId, 'account', accountId)

      expect(result).toEqual({
        canView: true,
        canModify: true,
        canDelete: false,
      })
    })

    it('should return default permissions for unknown resource type', async () => {
      const userId = 'user-123'
      const resourceId = 'resource-123'

      const result = await service.getUserPermissions(userId, 'unknown', resourceId)

      expect(result).toEqual({
        canView: false,
        canModify: false,
        canDelete: false,
      })
    })
  })

  describe('validateBulkAccess', () => {
    it('should validate access to multiple resources', async () => {
      const userId = 'user-123'
      const resources = [
        { type: 'household', id: 'household-1', requiredPermission: 'view' },
        { type: 'household', id: 'household-2', requiredPermission: 'modify' },
        { type: 'account', id: 'account-1', requiredPermission: 'view' },
      ]

      // Mock permission checks
      jest.spyOn(service, 'canViewHouseholdData')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      jest.spyOn(service, 'canModifyHouseholdData').mockResolvedValueOnce(true)
      jest.spyOn(service, 'userHasAccountAccess').mockResolvedValueOnce(true)

      const result = await service.validateBulkAccess(userId, resources)

      expect(result).toEqual({
        'household:household-1': true,
        'household:household-2': true,
        'account:account-1': true,
      })
    })
  })

  describe('healthCheck', () => {
    it('should return true when database is healthy', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })

      const result = await service.healthCheck()

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1')
    })

    it('should return false when database is unhealthy', async () => {
      mockClient.query.mockRejectedValue(new Error('Connection failed'))

      const result = await service.healthCheck()

      expect(result).toBe(false)
    })
  })

  describe('onModuleDestroy', () => {
    it('should end pool connection', async () => {
      await service.onModuleDestroy()

      expect(mockPool.end).toHaveBeenCalled()
    })
  })
})
