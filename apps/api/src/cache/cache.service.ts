// Created automatically by Cursor AI (2024-12-19)

import { Injectable, Inject } from '@nestjs/common'
import { Redis } from 'ioredis'

export interface FxRate {
  fromCurrency: string
  toCurrency: string
  rate: number
  timestamp: Date
  source: string
}

export interface MerchantCache {
  id: string
  name: string
  normalizedName: string
  category: string
  confidence: number
  embedding?: number[]
  metadata: any
}

export interface CategoryMap {
  id: string
  name: string
  parentId?: string
  path: string[]
  color: string
  icon?: string
}

export interface ForecastSnapshot {
  id: string
  householdId: string
  type: 'cashflow' | 'category' | 'account'
  data: any
  generatedAt: Date
  expiresAt: Date
}

@Injectable()
export class CacheService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  // FX Rates Cache
  async setFxRate(fromCurrency: string, toCurrency: string, rate: number, ttl: number = 3600): Promise<void> {
    const key = `fx_rate:${fromCurrency}:${toCurrency}`
    const data: FxRate = {
      fromCurrency,
      toCurrency,
      rate,
      timestamp: new Date(),
      source: 'cache',
    }
    await this.redis.setex(key, ttl, JSON.stringify(data))
  }

  async getFxRate(fromCurrency: string, toCurrency: string): Promise<FxRate | null> {
    const key = `fx_rate:${fromCurrency}:${toCurrency}`
    const data = await this.redis.get(key)
    if (!data) return null
    
    const fxRate: FxRate = JSON.parse(data)
    fxRate.timestamp = new Date(fxRate.timestamp)
    return fxRate
  }

  async getFxRates(baseCurrency: string): Promise<FxRate[]> {
    const pattern = `fx_rate:${baseCurrency}:*`
    const keys = await this.redis.keys(pattern)
    
    if (keys.length === 0) return []
    
    const rates = await this.redis.mget(keys)
    return rates
      .filter(rate => rate !== null)
      .map(rate => {
        const fxRate: FxRate = JSON.parse(rate!)
        fxRate.timestamp = new Date(fxRate.timestamp)
        return fxRate
      })
  }

  async invalidateFxRate(fromCurrency: string, toCurrency: string): Promise<void> {
    const key = `fx_rate:${fromCurrency}:${toCurrency}`
    await this.redis.del(key)
  }

  // Merchant Cache
  async setMerchant(merchantId: string, merchant: MerchantCache, ttl: number = 86400): Promise<void> {
    const key = `merchant:${merchantId}`
    await this.redis.setex(key, ttl, JSON.stringify(merchant))
    
    // Also store by normalized name for fuzzy matching
    const normalizedKey = `merchant:normalized:${merchant.normalizedName.toLowerCase()}`
    await this.redis.setex(normalizedKey, ttl, merchantId)
  }

  async getMerchant(merchantId: string): Promise<MerchantCache | null> {
    const key = `merchant:${merchantId}`
    const data = await this.redis.get(key)
    if (!data) return null
    
    return JSON.parse(data)
  }

  async getMerchantByNormalizedName(normalizedName: string): Promise<string | null> {
    const key = `merchant:normalized:${normalizedName.toLowerCase()}`
    return await this.redis.get(key)
  }

  async searchMerchants(query: string, limit: number = 10): Promise<MerchantCache[]> {
    const pattern = `merchant:normalized:*${query.toLowerCase()}*`
    const keys = await this.redis.keys(pattern)
    
    if (keys.length === 0) return []
    
    const merchantIds = await this.redis.mget(keys.slice(0, limit))
    const merchants = await this.redis.mget(
      merchantIds.filter(id => id !== null).map(id => `merchant:${id}`)
    )
    
    return merchants
      .filter(merchant => merchant !== null)
      .map(merchant => JSON.parse(merchant!))
  }

  async invalidateMerchant(merchantId: string): Promise<void> {
    const merchant = await this.getMerchant(merchantId)
    if (merchant) {
      const normalizedKey = `merchant:normalized:${merchant.normalizedName.toLowerCase()}`
      await this.redis.del(`merchant:${merchantId}`, normalizedKey)
    }
  }

  // Category Map Cache
  async setCategoryMap(householdId: string, categories: CategoryMap[], ttl: number = 3600): Promise<void> {
    const key = `category_map:${householdId}`
    await this.redis.setex(key, ttl, JSON.stringify(categories))
  }

  async getCategoryMap(householdId: string): Promise<CategoryMap[] | null> {
    const key = `category_map:${householdId}`
    const data = await this.redis.get(key)
    if (!data) return null
    
    return JSON.parse(data)
  }

  async getCategory(householdId: string, categoryId: string): Promise<CategoryMap | null> {
    const categories = await this.getCategoryMap(householdId)
    if (!categories) return null
    
    return categories.find(cat => cat.id === categoryId) || null
  }

  async invalidateCategoryMap(householdId: string): Promise<void> {
    const key = `category_map:${householdId}`
    await this.redis.del(key)
  }

  // Forecast Snapshots Cache
  async setForecastSnapshot(snapshot: ForecastSnapshot, ttl: number = 3600): Promise<void> {
    const key = `forecast:${snapshot.householdId}:${snapshot.type}:${snapshot.id}`
    await this.redis.setex(key, ttl, JSON.stringify(snapshot))
  }

  async getForecastSnapshot(householdId: string, type: string, snapshotId: string): Promise<ForecastSnapshot | null> {
    const key = `forecast:${householdId}:${type}:${snapshotId}`
    const data = await this.redis.get(key)
    if (!data) return null
    
    const snapshot: ForecastSnapshot = JSON.parse(data)
    snapshot.generatedAt = new Date(snapshot.generatedAt)
    snapshot.expiresAt = new Date(snapshot.expiresAt)
    return snapshot
  }

  async getLatestForecastSnapshot(householdId: string, type: string): Promise<ForecastSnapshot | null> {
    const pattern = `forecast:${householdId}:${type}:*`
    const keys = await this.redis.keys(pattern)
    
    if (keys.length === 0) return null
    
    // Sort by timestamp (assuming snapshot ID contains timestamp)
    keys.sort().reverse()
    const latestKey = keys[0]
    
    const data = await this.redis.get(latestKey)
    if (!data) return null
    
    const snapshot: ForecastSnapshot = JSON.parse(data)
    snapshot.generatedAt = new Date(snapshot.generatedAt)
    snapshot.expiresAt = new Date(snapshot.expiresAt)
    return snapshot
  }

  async invalidateForecastSnapshots(householdId: string, type?: string): Promise<void> {
    const pattern = type 
      ? `forecast:${householdId}:${type}:*`
      : `forecast:${householdId}:*`
    
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }

  // Budget Cache
  async setBudgetSnapshot(householdId: string, budgetId: string, data: any, ttl: number = 1800): Promise<void> {
    const key = `budget:${householdId}:${budgetId}`
    await this.redis.setex(key, ttl, JSON.stringify(data))
  }

  async getBudgetSnapshot(householdId: string, budgetId: string): Promise<any | null> {
    const key = `budget:${householdId}:${budgetId}`
    const data = await this.redis.get(key)
    if (!data) return null
    
    return JSON.parse(data)
  }

  async invalidateBudgetSnapshot(householdId: string, budgetId: string): Promise<void> {
    const key = `budget:${householdId}:${budgetId}`
    await this.redis.del(key)
  }

  // Account Balance Cache
  async setAccountBalance(accountId: string, balance: any, ttl: number = 300): Promise<void> {
    const key = `account_balance:${accountId}`
    await this.redis.setex(key, ttl, JSON.stringify(balance))
  }

  async getAccountBalance(accountId: string): Promise<any | null> {
    const key = `account_balance:${accountId}`
    const data = await this.redis.get(key)
    if (!data) return null
    
    return JSON.parse(data)
  }

  async invalidateAccountBalance(accountId: string): Promise<void> {
    const key = `account_balance:${accountId}`
    await this.redis.del(key)
  }

  // User Session Cache
  async setUserSession(userId: string, sessionData: any, ttl: number = 3600): Promise<void> {
    const key = `user_session:${userId}`
    await this.redis.setex(key, ttl, JSON.stringify(sessionData))
  }

  async getUserSession(userId: string): Promise<any | null> {
    const key = `user_session:${userId}`
    const data = await this.redis.get(key)
    if (!data) return null
    
    return JSON.parse(data)
  }

  async invalidateUserSession(userId: string): Promise<void> {
    const key = `user_session:${userId}`
    await this.redis.del(key)
  }

  // Rate Limiting
  async incrementRateLimit(key: string, window: number = 3600): Promise<number> {
    const current = await this.redis.incr(key)
    if (current === 1) {
      await this.redis.expire(key, window)
    }
    return current
  }

  async getRateLimit(key: string): Promise<number> {
    const current = await this.redis.get(key)
    return current ? parseInt(current) : 0
  }

  // Cache Statistics
  async getCacheStats(): Promise<any> {
    const info = await this.redis.info('memory')
    const keyspace = await this.redis.info('keyspace')
    
    // Count keys by pattern
    const patterns = [
      'fx_rate:*',
      'merchant:*',
      'category_map:*',
      'forecast:*',
      'budget:*',
      'account_balance:*',
      'user_session:*',
    ]
    
    const stats: any = {}
    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern)
      stats[pattern.replace(':*', '')] = keys.length
    }
    
    return {
      memory: info,
      keyspace,
      keyCounts: stats,
    }
  }

  // Cache Warming
  async warmFxRateCache(baseCurrency: string, targetCurrencies: string[]): Promise<void> {
    // This would typically call an external FX API and cache the results
    console.log(`Warming FX rate cache for ${baseCurrency} to ${targetCurrencies.join(', ')}`)
  }

  async warmMerchantCache(merchantIds: string[]): Promise<void> {
    // This would typically load merchants from the database and cache them
    console.log(`Warming merchant cache for ${merchantIds.length} merchants`)
  }

  async warmCategoryMapCache(householdIds: string[]): Promise<void> {
    // This would typically load category maps from the database and cache them
    console.log(`Warming category map cache for ${householdIds.length} households`)
  }

  // Cache Cleanup
  async cleanupExpiredKeys(): Promise<void> {
    // Redis automatically handles expiration, but we can add custom cleanup logic here
    console.log('Running cache cleanup')
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping()
      return true
    } catch (error) {
      console.error('Redis health check failed:', error)
      return false
    }
  }
}
