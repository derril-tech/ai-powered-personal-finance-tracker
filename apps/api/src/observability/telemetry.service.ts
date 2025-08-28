// Created automatically by Cursor AI (2024-12-19)

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { trace, metrics, context, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { MeterProvider } from '@opentelemetry/sdk-metrics'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core'
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'

export interface SpanContext {
  span: any
  setAttribute: (key: string, value: any) => void
  setAttributes: (attributes: Record<string, any>) => void
  addEvent: (name: string, attributes?: Record<string, any>) => void
  setStatus: (code: SpanStatusCode, message?: string) => void
  recordException: (exception: Error) => void
}

export interface MetricContext {
  counter: (name: string, description?: string) => any
  histogram: (name: string, description?: string) => any
  gauge: (name: string, description?: string) => any
}

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private tracer: any
  private meter: any
  private counters: Map<string, any> = new Map()
  private histograms: Map<string, any> = new Map()
  private gauges: Map<string, any> = new Map()

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTelemetry()
  }

  async onModuleDestroy() {
    // Cleanup telemetry resources
  }

  private async initializeTelemetry() {
    const serviceName = this.configService.get<string>('OTEL_SERVICE_NAME', 'finance-api')
    const serviceVersion = this.configService.get<string>('OTEL_SERVICE_VERSION', '1.0.0')
    const environment = this.configService.get<string>('NODE_ENV', 'development')
    
    const otelEndpoint = this.configService.get<string>('OTEL_EXPORTER_OTLP_ENDPOINT')
    const enableTelemetry = this.configService.get<boolean>('ENABLE_TELEMETRY', true)

    if (!enableTelemetry || !otelEndpoint) {
      console.log('Telemetry disabled or no endpoint configured')
      return
    }

    // Initialize resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
    })

    // Initialize tracer
    const tracerProvider = new NodeTracerProvider({
      resource,
    })

    const traceExporter = new OTLPTraceExporter({
      url: `${otelEndpoint}/v1/traces`,
    })

    const spanProcessor = environment === 'production' 
      ? new BatchSpanProcessor(traceExporter)
      : new SimpleSpanProcessor(traceExporter)

    tracerProvider.addSpanProcessor(spanProcessor)
    tracerProvider.register()

    this.tracer = trace.getTracer(serviceName, serviceVersion)

    // Initialize meter
    const meterProvider = new MeterProvider({
      resource,
    })

    const metricExporter = new OTLPMetricExporter({
      url: `${otelEndpoint}/v1/metrics`,
    })

    meterProvider.addMetricReader(metricExporter)
    metrics.setGlobalMeterProvider(meterProvider)

    this.meter = metrics.getMeter(serviceName, serviceVersion)

    // Register instrumentations
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation(),
        new NestInstrumentation(),
        new RedisInstrumentation(),
        new PgInstrumentation(),
      ],
    })

    console.log('Telemetry initialized')
  }

  // Tracing methods
  startSpan(name: string, kind: SpanKind = SpanKind.INTERNAL, attributes: Record<string, any> = {}): SpanContext {
    const span = this.tracer.startSpan(name, {
      kind,
      attributes,
    })

    return {
      span,
      setAttribute: (key: string, value: any) => span.setAttribute(key, value),
      setAttributes: (attributes: Record<string, any>) => span.setAttributes(attributes),
      addEvent: (name: string, attributes?: Record<string, any>) => span.addEvent(name, attributes),
      setStatus: (code: SpanStatusCode, message?: string) => span.setStatus({ code, message }),
      recordException: (exception: Error) => span.recordException(exception),
    }
  }

  startChildSpan(name: string, kind: SpanKind = SpanKind.INTERNAL, attributes: Record<string, any> = {}): SpanContext {
    const currentSpan = trace.getActiveSpan()
    if (!currentSpan) {
      return this.startSpan(name, kind, attributes)
    }

    const span = this.tracer.startSpan(name, {
      kind,
      attributes,
    }, trace.setSpan(context.active(), currentSpan))

    return {
      span,
      setAttribute: (key: string, value: any) => span.setAttribute(key, value),
      setAttributes: (attributes: Record<string, any>) => span.setAttributes(attributes),
      addEvent: (name: string, attributes?: Record<string, any>) => span.addEvent(name, attributes),
      setStatus: (code: SpanStatusCode, message?: string) => span.setStatus({ code, message }),
      recordException: (exception: Error) => span.recordException(exception),
    }
  }

  // Metrics methods
  getCounter(name: string, description?: string) {
    if (!this.counters.has(name)) {
      const counter = this.meter.createCounter(name, {
        description: description || name,
      })
      this.counters.set(name, counter)
    }
    return this.counters.get(name)
  }

  getHistogram(name: string, description?: string) {
    if (!this.histograms.has(name)) {
      const histogram = this.meter.createHistogram(name, {
        description: description || name,
      })
      this.histograms.set(name, histogram)
    }
    return this.histograms.get(name)
  }

  getGauge(name: string, description?: string) {
    if (!this.gauges.has(name)) {
      const gauge = this.meter.createUpDownCounter(name, {
        description: description || name,
      })
      this.gauges.set(name, gauge)
    }
    return this.gauges.get(name)
  }

  // Convenience methods for common operations
  recordApiCall(method: string, path: string, statusCode: number, duration: number) {
    const counter = this.getCounter('api_calls_total', 'Total API calls')
    const histogram = this.getHistogram('api_call_duration', 'API call duration')

    counter.add(1, {
      method,
      path,
      status_code: statusCode.toString(),
    })

    histogram.record(duration, {
      method,
      path,
      status_code: statusCode.toString(),
    })
  }

  recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean) {
    const counter = this.getCounter('database_queries_total', 'Total database queries')
    const histogram = this.getHistogram('database_query_duration', 'Database query duration')

    counter.add(1, {
      operation,
      table,
      success: success.toString(),
    })

    histogram.record(duration, {
      operation,
      table,
      success: success.toString(),
    })
  }

  recordCacheOperation(operation: 'get' | 'set' | 'delete', cache: string, hit: boolean, duration: number) {
    const counter = this.getCounter('cache_operations_total', 'Total cache operations')
    const histogram = this.getHistogram('cache_operation_duration', 'Cache operation duration')

    counter.add(1, {
      operation,
      cache,
      hit: hit.toString(),
    })

    histogram.record(duration, {
      operation,
      cache,
      hit: hit.toString(),
    })
  }

  recordWorkerJob(jobType: string, status: 'started' | 'completed' | 'failed', duration?: number) {
    const counter = this.getCounter('worker_jobs_total', 'Total worker jobs')
    
    counter.add(1, {
      job_type: jobType,
      status,
    })

    if (duration !== undefined) {
      const histogram = this.getHistogram('worker_job_duration', 'Worker job duration')
      histogram.record(duration, {
        job_type: jobType,
        status,
      })
    }
  }

  recordForecastGeneration(householdId: string, type: string, duration: number, accuracy?: number) {
    const counter = this.getCounter('forecasts_generated_total', 'Total forecasts generated')
    const histogram = this.getHistogram('forecast_generation_duration', 'Forecast generation duration')

    counter.add(1, {
      household_id: householdId,
      type,
    })

    histogram.record(duration, {
      household_id: householdId,
      type,
    })

    if (accuracy !== undefined) {
      const accuracyHistogram = this.getHistogram('forecast_accuracy', 'Forecast accuracy')
      accuracyHistogram.record(accuracy, {
        household_id: householdId,
        type,
      })
    }
  }

  recordAnomalyDetection(householdId: string, type: string, count: number, precision?: number, recall?: number) {
    const counter = this.getCounter('anomalies_detected_total', 'Total anomalies detected')
    
    counter.add(count, {
      household_id: householdId,
      type,
    })

    if (precision !== undefined) {
      const precisionHistogram = this.getHistogram('anomaly_detection_precision', 'Anomaly detection precision')
      precisionHistogram.record(precision, {
        household_id: householdId,
        type,
      })
    }

    if (recall !== undefined) {
      const recallHistogram = this.getHistogram('anomaly_detection_recall', 'Anomaly detection recall')
      recallHistogram.record(recall, {
        household_id: householdId,
        type,
      })
    }
  }

  recordReportGeneration(householdId: string, format: string, duration: number, fileSize?: number) {
    const counter = this.getCounter('reports_generated_total', 'Total reports generated')
    const histogram = this.getHistogram('report_generation_duration', 'Report generation duration')

    counter.add(1, {
      household_id: householdId,
      format,
    })

    histogram.record(duration, {
      household_id: householdId,
      format,
    })

    if (fileSize !== undefined) {
      const fileSizeHistogram = this.getHistogram('report_file_size', 'Report file size')
      fileSizeHistogram.record(fileSize, {
        household_id: householdId,
        format,
      })
    }
  }

  recordConnectorSync(provider: string, accountId: string, status: 'success' | 'failed', duration: number, error?: string) {
    const counter = this.getCounter('connector_syncs_total', 'Total connector syncs')
    const histogram = this.getHistogram('connector_sync_duration', 'Connector sync duration')

    counter.add(1, {
      provider,
      account_id: accountId,
      status,
      error: error || '',
    })

    histogram.record(duration, {
      provider,
      account_id: accountId,
      status,
    })
  }

  recordImportJob(householdId: string, format: string, status: 'started' | 'completed' | 'failed', rowCount: number, duration?: number) {
    const counter = this.getCounter('import_jobs_total', 'Total import jobs')
    
    counter.add(1, {
      household_id: householdId,
      format,
      status,
    })

    if (duration !== undefined) {
      const histogram = this.getHistogram('import_job_duration', 'Import job duration')
      histogram.record(duration, {
        household_id: householdId,
        format,
        status,
      })
    }

    const rowCounter = this.getCounter('import_rows_processed_total', 'Total rows processed in imports')
    rowCounter.add(rowCount, {
      household_id: householdId,
      format,
      status,
    })
  }

  // Error tracking
  recordError(error: Error, context: Record<string, any> = {}) {
    const counter = this.getCounter('errors_total', 'Total errors')
    
    counter.add(1, {
      error_type: error.constructor.name,
      error_message: error.message,
      ...context,
    })

    // Also record in current span if available
    const currentSpan = trace.getActiveSpan()
    if (currentSpan) {
      currentSpan.recordException(error)
      currentSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    }
  }

  // Business metrics
  recordUserAction(userId: string, action: string, metadata: Record<string, any> = {}) {
    const counter = this.getCounter('user_actions_total', 'Total user actions')
    
    counter.add(1, {
      user_id: userId,
      action,
      ...metadata,
    })
  }

  recordHouseholdMetrics(householdId: string, accountCount: number, transactionCount: number, budgetCount: number) {
    const accountGauge = this.getGauge('household_accounts', 'Number of accounts per household')
    const transactionGauge = this.getGauge('household_transactions', 'Number of transactions per household')
    const budgetGauge = this.getGauge('household_budgets', 'Number of budgets per household')

    accountGauge.add(accountCount, { household_id: householdId })
    transactionGauge.add(transactionCount, { household_id: householdId })
    budgetGauge.add(budgetCount, { household_id: householdId })
  }
}
