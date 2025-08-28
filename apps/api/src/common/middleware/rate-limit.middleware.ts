// Created automatically by Cursor AI (2024-12-19)

import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Skip counting successful requests
  skipFailedRequests?: boolean; // Skip counting failed requests
  message?: string; // Error message
  statusCode?: number; // HTTP status code for rate limit exceeded
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 requests per 15 minutes
      keyGenerator: this.defaultKeyGenerator,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Too many requests, please try again later.',
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    };

    this.handleRateLimit(req, res, next, config);
  }

  private async handleRateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
    config: RateLimitConfig,
  ) {
    try {
      const key = config.keyGenerator ? config.keyGenerator(req) : this.defaultKeyGenerator(req);
      const windowMs = config.windowMs;
      const maxRequests = config.maxRequests;

      // Get current request count
      const currentCount = await this.redis.get(key);
      const count = currentCount ? parseInt(currentCount, 10) : 0;

      if (count >= maxRequests) {
        // Rate limit exceeded
        const resetTime = await this.redis.ttl(key);
        
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', resetTime.toString());
        res.setHeader('Retry-After', Math.ceil(windowMs / 1000).toString());

        throw new HttpException(
          {
            statusCode: config.statusCode,
            message: config.message,
            error: 'Too Many Requests',
          },
          config.statusCode,
        );
      }

      // Increment request count
      const multi = this.redis.multi();
      multi.incr(key);
      multi.expire(key, Math.ceil(windowMs / 1000));

      const results = await multi.exec();
      const newCount = results[0][1] as number;

      // Set response headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(windowMs / 1000).toString());

      // Track usage for billing
      await this.trackUsage(req, newCount);

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis error, allow request to proceed
      console.error('Rate limit error:', error);
      next();
    }
  }

  private defaultKeyGenerator(req: Request): string {
    const orgId = req.headers['x-organization-id'] as string;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (orgId) {
      return `rate_limit:org:${orgId}:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
    }
    
    return `rate_limit:ip:${ip}:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
  }

  private async trackUsage(req: Request, requestCount: number): Promise<void> {
    try {
      const orgId = req.headers['x-organization-id'] as string;
      const userId = (req as any).user?.id;
      const endpoint = req.route?.path || req.path;
      const method = req.method;
      const timestamp = Math.floor(Date.now() / (15 * 60 * 1000)) * (15 * 60 * 1000); // 15-minute bucket

      if (orgId) {
        const usageKey = `usage:org:${orgId}:${timestamp}`;
        const endpointKey = `usage:org:${orgId}:endpoint:${timestamp}`;
        
        const multi = this.redis.multi();
        multi.hincrby(usageKey, 'total_requests', 1);
        multi.hincrby(usageKey, 'api_calls', 1);
        multi.hincrby(endpointKey, `${method}:${endpoint}`, 1);
        multi.expire(usageKey, 24 * 60 * 60); // 24 hours
        multi.expire(endpointKey, 24 * 60 * 60); // 24 hours
        
        await multi.exec();
      }

      if (userId) {
        const userUsageKey = `usage:user:${userId}:${timestamp}`;
        await this.redis.hincrby(userUsageKey, 'total_requests', 1);
        await this.redis.expire(userUsageKey, 24 * 60 * 60); // 24 hours
      }
    } catch (error) {
      console.error('Usage tracking error:', error);
      // Don't fail the request if usage tracking fails
    }
  }
}

// Factory function for custom rate limit configurations
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return class CustomRateLimitMiddleware extends RateLimitMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
      this.handleRateLimit(req, res, next, config);
    }
  };
}

// Specific rate limit configurations
export const ApiRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000,
  message: 'API rate limit exceeded. Please try again later.',
});

export const AuthRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
});

export const ImportRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 imports per hour
  message: 'Import rate limit exceeded. Please try again later.',
});

export const ExportRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 exports per hour
  message: 'Export rate limit exceeded. Please try again later.',
});
