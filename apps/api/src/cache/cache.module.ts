// Created automatically by Cursor AI (2024-12-19)

import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { CacheService } from './cache.service'

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379')
        const redisPassword = configService.get<string>('REDIS_PASSWORD')
        const redisDb = configService.get<number>('REDIS_DB', 0)
        
        const redis = new Redis(redisUrl, {
          password: redisPassword,
          db: redisDb,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          keepAlive: 30000,
          connectTimeout: 10000,
          commandTimeout: 5000,
        })

        redis.on('connect', () => {
          console.log('Connected to Redis')
        })

        redis.on('error', (error) => {
          console.error('Redis connection error:', error)
        })

        redis.on('close', () => {
          console.log('Redis connection closed')
        })

        redis.on('reconnecting', () => {
          console.log('Reconnecting to Redis...')
        })

        return redis
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
