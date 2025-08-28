// Created automatically by Cursor AI (2024-12-19)

import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Sentry from '@sentry/node'
import { ProfilingIntegration } from '@sentry/profiling-node'

export interface SentryContext {
  user?: {
    id: string
    email: string
    householdId?: string
    organizationId?: string
  }
  tags?: Record<string, string>
  extra?: Record<string, any>
  level?: Sentry.SeverityLevel
}

@Injectable()
export class SentryService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeSentry()
  }

  private async initializeSentry() {
    const dsn = this.configService.get<string>('SENTRY_DSN')
    const environment = this.configService.get<string>('NODE_ENV', 'development')
    const enableSentry = this.configService.get<boolean>('ENABLE_SENTRY', true)

    if (!enableSentry || !dsn) {
      console.log('Sentry disabled or no DSN configured')
      return
    }

    Sentry.init({
      dsn,
      environment,
      integrations: [
        new ProfilingIntegration(),
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: undefined }),
        new Sentry.Integrations.Postgres(),
        new Sentry.Integrations.Redis(),
      ],
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
      beforeSend(event, hint) {
        // Filter out certain errors or modify events before sending
        const error = hint.originalException
        
        // Don't send 4xx errors to Sentry
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status
          if (status >= 400 && status < 500) {
            return null
          }
        }

        // Don't send validation errors
        if (error && typeof error === 'object' && 'name' in error) {
          const name = (error as any).name
          if (name === 'ValidationError' || name === 'ZodError') {
            return null
          }
        }

        return event
      },
    })

    console.log('Sentry initialized')
  }

  // Error tracking methods
  captureException(error: Error, context?: SentryContext) {
    if (!Sentry.getCurrentHub().getClient()) {
      console.error('Sentry not initialized, logging error:', error)
      return
    }

    const scope = new Sentry.Scope()
    
    if (context?.user) {
      scope.setUser(context.user)
    }
    
    if (context?.tags) {
      scope.setTags(context.tags)
    }
    
    if (context?.extra) {
      scope.setExtras(context.extra)
    }
    
    if (context?.level) {
      scope.setLevel(context.level)
    }

    Sentry.captureException(error, scope)
  }

  captureMessage(message: string, context?: SentryContext) {
    if (!Sentry.getCurrentHub().getClient()) {
      console.log('Sentry not initialized, logging message:', message)
      return
    }

    const scope = new Sentry.Scope()
    
    if (context?.user) {
      scope.setUser(context.user)
    }
    
    if (context?.tags) {
      scope.setTags(context.tags)
    }
    
    if (context?.extra) {
      scope.setExtras(context.extra)
    }
    
    if (context?.level) {
      scope.setLevel(context.level)
    }

    Sentry.captureMessage(message, scope)
  }

  // Performance monitoring
  startTransaction(name: string, operation: string, context?: SentryContext) {
    if (!Sentry.getCurrentHub().getClient()) {
      return null
    }

    const transaction = Sentry.startTransaction({
      name,
      op: operation,
    })

    const scope = new Sentry.Scope()
    scope.setSpan(transaction)
    
    if (context?.user) {
      scope.setUser(context.user)
    }
    
    if (context?.tags) {
      scope.setTags(context.tags)
    }
    
    if (context?.extra) {
      scope.setExtras(context.extra)
    }

    Sentry.getCurrentHub().configureScope(scope)
    return transaction
  }

  // Convenience methods for common error patterns
  captureConnectorError(provider: string, accountId: string, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'connector_failure',
        provider,
        account_id: accountId,
      },
      extra: {
        provider,
        accountId,
        ...context,
      },
      level: 'error',
    })
  }

  captureParseError(format: string, fileName: string, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'parse_error',
        format,
        file_name: fileName,
      },
      extra: {
        format,
        fileName,
        ...context,
      },
      level: 'error',
    })
  }

  captureModelRegression(modelType: string, accuracy: number, expectedAccuracy: number, context?: Record<string, any>) {
    this.captureMessage(`Model regression detected: ${modelType} accuracy ${accuracy} below expected ${expectedAccuracy}`, {
      tags: {
        error_type: 'model_regression',
        model_type: modelType,
      },
      extra: {
        modelType,
        accuracy,
        expectedAccuracy,
        ...context,
      },
      level: 'warning',
    })
  }

  captureDatabaseError(operation: string, table: string, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'database_error',
        operation,
        table,
      },
      extra: {
        operation,
        table,
        ...context,
      },
      level: 'error',
    })
  }

  captureCacheError(operation: string, cache: string, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'cache_error',
        operation,
        cache,
      },
      extra: {
        operation,
        cache,
        ...context,
      },
      level: 'error',
    })
  }

  captureApiError(method: string, path: string, statusCode: number, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'api_error',
        method,
        path,
        status_code: statusCode.toString(),
      },
      extra: {
        method,
        path,
        statusCode,
        ...context,
      },
      level: statusCode >= 500 ? 'error' : 'warning',
    })
  }

  captureWorkerError(jobType: string, jobId: string, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'worker_error',
        job_type: jobType,
        job_id: jobId,
      },
      extra: {
        jobType,
        jobId,
        ...context,
      },
      level: 'error',
    })
  }

  captureImportError(format: string, householdId: string, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'import_error',
        format,
        household_id: householdId,
      },
      extra: {
        format,
        householdId,
        ...context,
      },
      level: 'error',
    })
  }

  captureForecastError(householdId: string, type: string, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'forecast_error',
        household_id: householdId,
        forecast_type: type,
      },
      extra: {
        householdId,
        type,
        ...context,
      },
      level: 'error',
    })
  }

  captureAnomalyError(householdId: string, type: string, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'anomaly_error',
        household_id: householdId,
        anomaly_type: type,
      },
      extra: {
        householdId,
        type,
        ...context,
      },
      level: 'error',
    })
  }

  captureReportError(householdId: string, format: string, error: Error, context?: Record<string, any>) {
    this.captureException(error, {
      tags: {
        error_type: 'report_error',
        household_id: householdId,
        format,
      },
      extra: {
        householdId,
        format,
        ...context,
      },
      level: 'error',
    })
  }

  // Business event tracking
  captureUserAction(userId: string, action: string, metadata?: Record<string, any>) {
    this.captureMessage(`User action: ${action}`, {
      user: { id: userId },
      tags: {
        event_type: 'user_action',
        action,
      },
      extra: {
        userId,
        action,
        ...metadata,
      },
      level: 'info',
    })
  }

  captureHouseholdEvent(householdId: string, event: string, metadata?: Record<string, any>) {
    this.captureMessage(`Household event: ${event}`, {
      tags: {
        event_type: 'household_event',
        household_id: householdId,
        event,
      },
      extra: {
        householdId,
        event,
        ...metadata,
      },
      level: 'info',
    })
  }

  // Performance monitoring helpers
  captureSlowQuery(operation: string, table: string, duration: number, threshold: number = 1000) {
    if (duration > threshold) {
      this.captureMessage(`Slow query detected: ${operation} on ${table} took ${duration}ms`, {
        tags: {
          event_type: 'slow_query',
          operation,
          table,
        },
        extra: {
          operation,
          table,
          duration,
          threshold,
        },
        level: 'warning',
      })
    }
  }

  captureHighMemoryUsage(usage: number, threshold: number = 0.9) {
    if (usage > threshold) {
      this.captureMessage(`High memory usage detected: ${(usage * 100).toFixed(1)}%`, {
        tags: {
          event_type: 'high_memory_usage',
        },
        extra: {
          usage,
          threshold,
        },
        level: 'warning',
      })
    }
  }

  captureHighCpuUsage(usage: number, threshold: number = 0.8) {
    if (usage > threshold) {
      this.captureMessage(`High CPU usage detected: ${(usage * 100).toFixed(1)}%`, {
        tags: {
          event_type: 'high_cpu_usage',
        },
        extra: {
          usage,
          threshold,
        },
        level: 'warning',
      })
    }
  }

  // Set user context for current scope
  setUser(user: { id: string; email: string; householdId?: string; organizationId?: string }) {
    if (Sentry.getCurrentHub().getClient()) {
      Sentry.setUser(user)
    }
  }

  // Set tags for current scope
  setTags(tags: Record<string, string>) {
    if (Sentry.getCurrentHub().getClient()) {
      Sentry.setTags(tags)
    }
  }

  // Set extra data for current scope
  setExtra(key: string, value: any) {
    if (Sentry.getCurrentHub().getClient()) {
      Sentry.setExtra(key, value)
    }
  }

  // Flush events (useful for graceful shutdown)
  async flush(timeout?: number): Promise<boolean> {
    if (Sentry.getCurrentHub().getClient()) {
      return await Sentry.flush(timeout)
    }
    return true
  }
}
