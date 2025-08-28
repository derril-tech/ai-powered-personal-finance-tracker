// Created automatically by Cursor AI (2024-12-19)

import { Injectable } from '@nestjs/common'
import { Subject, Observable, Subscription } from 'rxjs'

interface ProgressData {
  id: string
  type: 'import' | 'forecast' | 'report' | 'sync'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  error?: string
  data?: any
  timestamp: string
}

interface SubscriptionData {
  unsubscribe: () => void
}

@Injectable()
export class SseService {
  private importProgressSubjects = new Map<string, Subject<ProgressData>>()
  private forecastProgressSubjects = new Map<string, Subject<ProgressData>>()
  private reportProgressSubjects = new Map<string, Subject<ProgressData>>()
  private syncProgressSubjects = new Map<string, Subject<ProgressData>>()

  subscribeToImportProgress(importId: string, callback: (data: ProgressData) => void): SubscriptionData {
    let subject = this.importProgressSubjects.get(importId)
    if (!subject) {
      subject = new Subject<ProgressData>()
      this.importProgressSubjects.set(importId, subject)
    }

    const subscription = subject.subscribe(callback)

    return {
      unsubscribe: () => {
        subscription.unsubscribe()
        // Clean up subject if no more subscribers
        if (subject && subject.observers.length === 0) {
          this.importProgressSubjects.delete(importId)
        }
      }
    }
  }

  subscribeToForecastProgress(forecastId: string, callback: (data: ProgressData) => void): SubscriptionData {
    let subject = this.forecastProgressSubjects.get(forecastId)
    if (!subject) {
      subject = new Subject<ProgressData>()
      this.forecastProgressSubjects.set(forecastId, subject)
    }

    const subscription = subject.subscribe(callback)

    return {
      unsubscribe: () => {
        subscription.unsubscribe()
        if (subject && subject.observers.length === 0) {
          this.forecastProgressSubjects.delete(forecastId)
        }
      }
    }
  }

  subscribeToReportProgress(reportId: string, callback: (data: ProgressData) => void): SubscriptionData {
    let subject = this.reportProgressSubjects.get(reportId)
    if (!subject) {
      subject = new Subject<ProgressData>()
      this.reportProgressSubjects.set(reportId, subject)
    }

    const subscription = subject.subscribe(callback)

    return {
      unsubscribe: () => {
        subscription.unsubscribe()
        if (subject && subject.observers.length === 0) {
          this.reportProgressSubjects.delete(reportId)
        }
      }
    }
  }

  subscribeToSyncProgress(accountId: string, callback: (data: ProgressData) => void): SubscriptionData {
    let subject = this.syncProgressSubjects.get(accountId)
    if (!subject) {
      subject = new Subject<ProgressData>()
      this.syncProgressSubjects.set(accountId, subject)
    }

    const subscription = subject.subscribe(callback)

    return {
      unsubscribe: () => {
        subscription.unsubscribe()
        if (subject && subject.observers.length === 0) {
          this.syncProgressSubjects.delete(accountId)
        }
      }
    }
  }

  emitImportProgress(importId: string, data: Omit<ProgressData, 'id' | 'type' | 'timestamp'>) {
    const subject = this.importProgressSubjects.get(importId)
    if (subject) {
      subject.next({
        ...data,
        id: importId,
        type: 'import',
        timestamp: new Date().toISOString(),
      })
    }
  }

  emitForecastProgress(forecastId: string, data: Omit<ProgressData, 'id' | 'type' | 'timestamp'>) {
    const subject = this.forecastProgressSubjects.get(forecastId)
    if (subject) {
      subject.next({
        ...data,
        id: forecastId,
        type: 'forecast',
        timestamp: new Date().toISOString(),
      })
    }
  }

  emitReportProgress(reportId: string, data: Omit<ProgressData, 'id' | 'type' | 'timestamp'>) {
    const subject = this.reportProgressSubjects.get(reportId)
    if (subject) {
      subject.next({
        ...data,
        id: reportId,
        type: 'report',
        timestamp: new Date().toISOString(),
      })
    }
  }

  emitSyncProgress(accountId: string, data: Omit<ProgressData, 'id' | 'type' | 'timestamp'>) {
    const subject = this.syncProgressSubjects.get(accountId)
    if (subject) {
      subject.next({
        ...data,
        id: accountId,
        type: 'sync',
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Utility methods for common progress updates
  emitImportStarted(importId: string, message?: string) {
    this.emitImportProgress(importId, {
      status: 'processing',
      progress: 0,
      message: message || 'Import started',
    })
  }

  emitImportProgressUpdate(importId: string, progress: number, message?: string) {
    this.emitImportProgress(importId, {
      status: 'processing',
      progress,
      message,
    })
  }

  emitImportCompleted(importId: string, data?: any) {
    this.emitImportProgress(importId, {
      status: 'completed',
      progress: 100,
      message: 'Import completed successfully',
      data,
    })
  }

  emitImportFailed(importId: string, error: string) {
    this.emitImportProgress(importId, {
      status: 'failed',
      progress: 0,
      error,
    })
  }

  emitForecastStarted(forecastId: string, message?: string) {
    this.emitForecastProgress(forecastId, {
      status: 'processing',
      progress: 0,
      message: message || 'Forecast generation started',
    })
  }

  emitForecastProgressUpdate(forecastId: string, progress: number, message?: string) {
    this.emitForecastProgress(forecastId, {
      status: 'processing',
      progress,
      message,
    })
  }

  emitForecastCompleted(forecastId: string, data?: any) {
    this.emitForecastProgress(forecastId, {
      status: 'completed',
      progress: 100,
      message: 'Forecast completed successfully',
      data,
    })
  }

  emitForecastFailed(forecastId: string, error: string) {
    this.emitForecastProgress(forecastId, {
      status: 'failed',
      progress: 0,
      error,
    })
  }

  emitReportStarted(reportId: string, message?: string) {
    this.emitReportProgress(reportId, {
      status: 'processing',
      progress: 0,
      message: message || 'Report generation started',
    })
  }

  emitReportProgressUpdate(reportId: string, progress: number, message?: string) {
    this.emitReportProgress(reportId, {
      status: 'processing',
      progress,
      message,
    })
  }

  emitReportCompleted(reportId: string, data?: any) {
    this.emitReportProgress(reportId, {
      status: 'completed',
      progress: 100,
      message: 'Report generated successfully',
      data,
    })
  }

  emitReportFailed(reportId: string, error: string) {
    this.emitReportProgress(reportId, {
      status: 'failed',
      progress: 0,
      error,
    })
  }

  emitSyncStarted(accountId: string, message?: string) {
    this.emitSyncProgress(accountId, {
      status: 'processing',
      progress: 0,
      message: message || 'Account sync started',
    })
  }

  emitSyncProgressUpdate(accountId: string, progress: number, message?: string) {
    this.emitSyncProgress(accountId, {
      status: 'processing',
      progress,
      message,
    })
  }

  emitSyncCompleted(accountId: string, data?: any) {
    this.emitSyncProgress(accountId, {
      status: 'completed',
      progress: 100,
      message: 'Account sync completed successfully',
      data,
    })
  }

  emitSyncFailed(accountId: string, error: string) {
    this.emitSyncProgress(accountId, {
      status: 'failed',
      progress: 0,
      error,
    })
  }

  // Cleanup methods
  cleanupImportProgress(importId: string) {
    const subject = this.importProgressSubjects.get(importId)
    if (subject) {
      subject.complete()
      this.importProgressSubjects.delete(importId)
    }
  }

  cleanupForecastProgress(forecastId: string) {
    const subject = this.forecastProgressSubjects.get(forecastId)
    if (subject) {
      subject.complete()
      this.forecastProgressSubjects.delete(forecastId)
    }
  }

  cleanupReportProgress(reportId: string) {
    const subject = this.reportProgressSubjects.get(reportId)
    if (subject) {
      subject.complete()
      this.reportProgressSubjects.delete(reportId)
    }
  }

  cleanupSyncProgress(accountId: string) {
    const subject = this.syncProgressSubjects.get(accountId)
    if (subject) {
      subject.complete()
      this.syncProgressSubjects.delete(accountId)
    }
  }

  // Get active subscriptions count for monitoring
  getActiveSubscriptionsCount() {
    return {
      imports: this.importProgressSubjects.size,
      forecasts: this.forecastProgressSubjects.size,
      reports: this.reportProgressSubjects.size,
      sync: this.syncProgressSubjects.size,
    }
  }
}
