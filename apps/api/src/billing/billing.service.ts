// Created automatically by Cursor AI (2024-12-19)

import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'
import { RlsService } from '../database/rls.service'
import { TelemetryService } from '../observability/telemetry.service'
import { SentryService } from '../observability/sentry.service'

export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  currency: string
  features: Record<string, any>
  limits: Record<string, any>
  isActive: boolean
}

export interface OrganizationSubscription {
  id: string
  organizationId: string
  planId: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid'
  billingCycle: 'monthly' | 'yearly'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  canceledAt?: Date
  trialStart?: Date
  trialEnd?: Date
}

export interface AddonProduct {
  id: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  currency: string
  unitType: 'seats' | 'connections' | 'storage_gb' | 'api_calls' | 'support_tier'
  isActive: boolean
}

export interface OrganizationAddon {
  id: string
  organizationId: string
  addonId: string
  quantity: number
  status: 'active' | 'canceled'
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

export interface UsageMetric {
  id: string
  organizationId: string
  metricName: string
  metricValue: number
  metricDate: Date
}

export interface UsageEvent {
  id: string
  organizationId: string
  userId?: string
  eventType: string
  eventData?: Record<string, any>
  metricValue: number
  createdAt: Date
}

export interface Invoice {
  id: string
  organizationId: string
  invoiceNumber: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  amount: number
  currency: string
  taxAmount: number
  totalAmount: number
  billingPeriodStart: Date
  billingPeriodEnd: Date
  dueDate: Date
  paidAt?: Date
}

export interface InvoiceLineItem {
  id: string
  invoiceId: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  metadata?: Record<string, any>
}

export interface BillingInfo {
  id: string
  organizationId: string
  billingEmail: string
  billingAddress?: Record<string, any>
  taxId?: string
  currency: string
  timezone: string
}

export interface PaymentMethod {
  id: string
  organizationId: string
  type: 'card' | 'bank_account' | 'paypal'
  provider: string
  providerPaymentMethodId: string
  isDefault: boolean
  metadata?: Record<string, any>
}

@Injectable()
export class BillingService implements OnModuleInit {
  private pool: Pool

  constructor(
    private configService: ConfigService,
    private rlsService: RlsService,
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

  async onModuleInit() {
    console.log('Billing service initialized')
  }

  // Subscription Plan Management
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price_monthly'
      )
      return result.rows.map(this.mapSubscriptionPlan)
    } finally {
      client.release()
    }
  }

  async getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true',
        [planId]
      )
      return result.rows.length > 0 ? this.mapSubscriptionPlan(result.rows[0]) : null
    } finally {
      client.release()
    }
  }

  // Organization Subscription Management
  async getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | null> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM organization_subscriptions WHERE organization_id = $1',
        [organizationId]
      )
      return result.rows.length > 0 ? this.mapOrganizationSubscription(result.rows[0]) : null
    } finally {
      client.release()
    }
  }

  async createSubscription(
    organizationId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly',
    trialDays: number = 0
  ): Promise<OrganizationSubscription> {
    const span = this.telemetryService.startSpan('create_subscription')
    
    try {
      span.setAttribute('organization_id', organizationId)
      span.setAttribute('plan_id', planId)
      span.setAttribute('billing_cycle', billingCycle)

      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')

        const now = new Date()
        const currentPeriodStart = now
        const currentPeriodEnd = new Date(now.getTime() + (billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000)
        
        let trialStart: Date | undefined
        let trialEnd: Date | undefined
        
        if (trialDays > 0) {
          trialStart = now
          trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
        }

        const result = await client.query(
          `INSERT INTO organization_subscriptions 
           (organization_id, plan_id, billing_cycle, current_period_start, current_period_end, trial_start, trial_end)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [organizationId, planId, billingCycle, currentPeriodStart, currentPeriodEnd, trialStart, trialEnd]
        )

        const subscription = this.mapOrganizationSubscription(result.rows[0])

        // Log the subscription creation
        await client.query(
          `INSERT INTO audit_log (organization_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [organizationId, 'subscription_created', 'subscription', subscription.id, { planId, billingCycle, trialDays }]
        )

        await client.query('COMMIT')

        // Track the subscription creation
        this.telemetryService.recordUserAction(organizationId, 'subscription_created', {
          subscriptionId: subscription.id,
          planId,
          billingCycle,
          trialDays,
        })

        span.setStatus({ code: 0, message: 'Subscription created successfully' })
        return subscription
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to create subscription' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'subscription_creation_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  async cancelSubscription(organizationId: string, cancelAtPeriodEnd: boolean = true): Promise<OrganizationSubscription> {
    const span = this.telemetryService.startSpan('cancel_subscription')
    
    try {
      span.setAttribute('organization_id', organizationId)
      span.setAttribute('cancel_at_period_end', cancelAtPeriodEnd)

      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')

        const updateData: any = {
          cancelAtPeriodEnd,
          updatedAt: new Date(),
        }

        if (!cancelAtPeriodEnd) {
          updateData.status = 'canceled'
          updateData.canceledAt = new Date()
        }

        const result = await client.query(
          `UPDATE organization_subscriptions 
           SET cancel_at_period_end = $1, status = $2, canceled_at = $3, updated_at = $4
           WHERE organization_id = $5
           RETURNING *`,
          [cancelAtPeriodEnd, updateData.status || 'active', updateData.canceledAt, updateData.updatedAt, organizationId]
        )

        if (result.rows.length === 0) {
          throw new Error('Subscription not found')
        }

        const subscription = this.mapOrganizationSubscription(result.rows[0])

        // Log the subscription cancellation
        await client.query(
          `INSERT INTO audit_log (organization_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [organizationId, 'subscription_canceled', 'subscription', subscription.id, { cancelAtPeriodEnd }]
        )

        await client.query('COMMIT')

        // Track the subscription cancellation
        this.telemetryService.recordUserAction(organizationId, 'subscription_canceled', {
          subscriptionId: subscription.id,
          cancelAtPeriodEnd,
        })

        span.setStatus({ code: 0, message: 'Subscription canceled successfully' })
        return subscription
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to cancel subscription' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'subscription_cancellation_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Add-on Management
  async getAddonProducts(): Promise<AddonProduct[]> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM addon_products WHERE is_active = true ORDER BY price_monthly'
      )
      return result.rows.map(this.mapAddonProduct)
    } finally {
      client.release()
    }
  }

  async getOrganizationAddons(organizationId: string): Promise<OrganizationAddon[]> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM organization_addons WHERE organization_id = $1 AND status = $2',
        [organizationId, 'active']
      )
      return result.rows.map(this.mapOrganizationAddon)
    } finally {
      client.release()
    }
  }

  async addAddon(
    organizationId: string,
    addonId: string,
    quantity: number = 1
  ): Promise<OrganizationAddon> {
    const span = this.telemetryService.startSpan('add_addon')
    
    try {
      span.setAttribute('organization_id', organizationId)
      span.setAttribute('addon_id', addonId)
      span.setAttribute('quantity', quantity)

      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')

        const now = new Date()
        const currentPeriodStart = now
        const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // Monthly cycle

        const result = await client.query(
          `INSERT INTO organization_addons 
           (organization_id, addon_id, quantity, current_period_start, current_period_end)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (organization_id, addon_id) 
           DO UPDATE SET quantity = $3, updated_at = $6
           RETURNING *`,
          [organizationId, addonId, quantity, currentPeriodStart, currentPeriodEnd, now]
        )

        const addon = this.mapOrganizationAddon(result.rows[0])

        // Log the addon addition
        await client.query(
          `INSERT INTO audit_log (organization_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [organizationId, 'addon_added', 'addon', addon.id, { addonId, quantity }]
        )

        await client.query('COMMIT')

        // Track the addon addition
        this.telemetryService.recordUserAction(organizationId, 'addon_added', {
          addonId: addon.id,
          addonProductId: addonId,
          quantity,
        })

        span.setStatus({ code: 0, message: 'Addon added successfully' })
        return addon
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to add addon' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'addon_addition_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  async removeAddon(organizationId: string, addonId: string): Promise<void> {
    const span = this.telemetryService.startSpan('remove_addon')
    
    try {
      span.setAttribute('organization_id', organizationId)
      span.setAttribute('addon_id', addonId)

      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')

        const result = await client.query(
          `UPDATE organization_addons 
           SET status = $1, updated_at = $2
           WHERE organization_id = $3 AND addon_id = $4
           RETURNING *`,
          ['canceled', new Date(), organizationId, addonId]
        )

        if (result.rows.length === 0) {
          throw new Error('Addon not found')
        }

        const addon = this.mapOrganizationAddon(result.rows[0])

        // Log the addon removal
        await client.query(
          `INSERT INTO audit_log (organization_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [organizationId, 'addon_removed', 'addon', addon.id, { addonId }]
        )

        await client.query('COMMIT')

        // Track the addon removal
        this.telemetryService.recordUserAction(organizationId, 'addon_removed', {
          addonId: addon.id,
          addonProductId: addonId,
        })

        span.setStatus({ code: 0, message: 'Addon removed successfully' })
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to remove addon' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'addon_removal_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Usage Tracking
  async recordUsageEvent(
    organizationId: string,
    eventType: string,
    metricValue: number = 1,
    userId?: string,
    eventData?: Record<string, any>
  ): Promise<void> {
    const span = this.telemetryService.startSpan('record_usage_event')
    
    try {
      span.setAttribute('organization_id', organizationId)
      span.setAttribute('event_type', eventType)
      span.setAttribute('metric_value', metricValue)

      const client = await this.pool.connect()
      
      try {
        // Record the usage event
        await client.query(
          `INSERT INTO usage_events 
           (organization_id, user_id, event_type, event_data, metric_value)
           VALUES ($1, $2, $3, $4, $5)`,
          [organizationId, userId, eventType, eventData ? JSON.stringify(eventData) : null, metricValue]
        )

        // Update daily usage metrics
        const today = new Date().toISOString().split('T')[0]
        await client.query(
          `INSERT INTO usage_metrics (organization_id, metric_name, metric_value, metric_date)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (organization_id, metric_name, metric_date)
           DO UPDATE SET metric_value = usage_metrics.metric_value + $3`,
          [organizationId, eventType, metricValue, today]
        )

        span.setStatus({ code: 0, message: 'Usage event recorded successfully' })
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to record usage event' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'usage_event_recording_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  async getUsageMetrics(
    organizationId: string,
    metricName?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageMetric[]> {
    const client = await this.pool.connect()
    
    try {
      let query = 'SELECT * FROM usage_metrics WHERE organization_id = $1'
      const params: any[] = [organizationId]
      let paramIndex = 2

      if (metricName) {
        query += ` AND metric_name = $${paramIndex}`
        params.push(metricName)
        paramIndex++
      }

      if (startDate) {
        query += ` AND metric_date >= $${paramIndex}`
        params.push(startDate.toISOString().split('T')[0])
        paramIndex++
      }

      if (endDate) {
        query += ` AND metric_date <= $${paramIndex}`
        params.push(endDate.toISOString().split('T')[0])
        paramIndex++
      }

      query += ' ORDER BY metric_date DESC'

      const result = await client.query(query, params)
      return result.rows.map(this.mapUsageMetric)
    } finally {
      client.release()
    }
  }

  async getCurrentUsage(organizationId: string): Promise<Record<string, number>> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        `SELECT metric_name, SUM(metric_value) as total_value
         FROM usage_metrics 
         WHERE organization_id = $1 
         AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY metric_name`,
        [organizationId]
      )

      const usage: Record<string, number> = {}
      result.rows.forEach(row => {
        usage[row.metric_name] = parseFloat(row.total_value)
      })

      return usage
    } finally {
      client.release()
    }
  }

  // Billing Info Management
  async getBillingInfo(organizationId: string): Promise<BillingInfo | null> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM organization_billing WHERE organization_id = $1',
        [organizationId]
      )
      return result.rows.length > 0 ? this.mapBillingInfo(result.rows[0]) : null
    } finally {
      client.release()
    }
  }

  async updateBillingInfo(
    organizationId: string,
    billingEmail: string,
    billingAddress?: Record<string, any>,
    taxId?: string,
    currency: string = 'USD',
    timezone: string = 'UTC'
  ): Promise<BillingInfo> {
    const span = this.telemetryService.startSpan('update_billing_info')
    
    try {
      span.setAttribute('organization_id', organizationId)

      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')

        const result = await client.query(
          `INSERT INTO organization_billing 
           (organization_id, billing_email, billing_address, tax_id, currency, timezone)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (organization_id) 
           DO UPDATE SET 
             billing_email = $2, 
             billing_address = $3, 
             tax_id = $4, 
             currency = $5, 
             timezone = $6,
             updated_at = NOW()
           RETURNING *`,
          [organizationId, billingEmail, billingAddress ? JSON.stringify(billingAddress) : null, taxId, currency, timezone]
        )

        const billingInfo = this.mapBillingInfo(result.rows[0])

        // Log the billing info update
        await client.query(
          `INSERT INTO audit_log (organization_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [organizationId, 'billing_info_updated', 'billing_info', billingInfo.id, { billingEmail, currency, timezone }]
        )

        await client.query('COMMIT')

        span.setStatus({ code: 0, message: 'Billing info updated successfully' })
        return billingInfo
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to update billing info' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'billing_info_update_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Invoice Management
  async getInvoices(organizationId: string, limit: number = 10, offset: number = 0): Promise<Invoice[]> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM invoices WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [organizationId, limit, offset]
      )
      return result.rows.map(this.mapInvoice)
    } finally {
      client.release()
    }
  }

  async getInvoice(invoiceId: string, organizationId: string): Promise<Invoice | null> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM invoices WHERE id = $1 AND organization_id = $2',
        [invoiceId, organizationId]
      )
      return result.rows.length > 0 ? this.mapInvoice(result.rows[0]) : null
    } finally {
      client.release()
    }
  }

  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY created_at',
        [invoiceId]
      )
      return result.rows.map(this.mapInvoiceLineItem)
    } finally {
      client.release()
    }
  }

  // Payment Methods
  async getPaymentMethods(organizationId: string): Promise<PaymentMethod[]> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(
        'SELECT * FROM payment_methods WHERE organization_id = $1 ORDER BY is_default DESC, created_at DESC',
        [organizationId]
      )
      return result.rows.map(this.mapPaymentMethod)
    } finally {
      client.release()
    }
  }

  async addPaymentMethod(
    organizationId: string,
    type: 'card' | 'bank_account' | 'paypal',
    provider: string,
    providerPaymentMethodId: string,
    isDefault: boolean = false,
    metadata?: Record<string, any>
  ): Promise<PaymentMethod> {
    const span = this.telemetryService.startSpan('add_payment_method')
    
    try {
      span.setAttribute('organization_id', organizationId)
      span.setAttribute('payment_type', type)
      span.setAttribute('provider', provider)

      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')

        // If this is the default payment method, unset other defaults
        if (isDefault) {
          await client.query(
            'UPDATE payment_methods SET is_default = false WHERE organization_id = $1',
            [organizationId]
          )
        }

        const result = await client.query(
          `INSERT INTO payment_methods 
           (organization_id, type, provider, provider_payment_method_id, is_default, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [organizationId, type, provider, providerPaymentMethodId, isDefault, metadata ? JSON.stringify(metadata) : null]
        )

        const paymentMethod = this.mapPaymentMethod(result.rows[0])

        // Log the payment method addition
        await client.query(
          `INSERT INTO audit_log (organization_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [organizationId, 'payment_method_added', 'payment_method', paymentMethod.id, { type, provider, isDefault }]
        )

        await client.query('COMMIT')

        span.setStatus({ code: 0, message: 'Payment method added successfully' })
        return paymentMethod
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to add payment method' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'payment_method_addition_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  async removePaymentMethod(paymentMethodId: string, organizationId: string): Promise<void> {
    const span = this.telemetryService.startSpan('remove_payment_method')
    
    try {
      span.setAttribute('organization_id', organizationId)
      span.setAttribute('payment_method_id', paymentMethodId)

      const client = await this.pool.connect()
      
      try {
        await client.query('BEGIN')

        const result = await client.query(
          'DELETE FROM payment_methods WHERE id = $1 AND organization_id = $2 RETURNING *',
          [paymentMethodId, organizationId]
        )

        if (result.rows.length === 0) {
          throw new Error('Payment method not found')
        }

        const paymentMethod = this.mapPaymentMethod(result.rows[0])

        // Log the payment method removal
        await client.query(
          `INSERT INTO audit_log (organization_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [organizationId, 'payment_method_removed', 'payment_method', paymentMethod.id, { type: paymentMethod.type, provider: paymentMethod.provider }]
        )

        await client.query('COMMIT')

        span.setStatus({ code: 0, message: 'Payment method removed successfully' })
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: 1, message: 'Failed to remove payment method' })
      this.sentryService.captureException(error, {
        tags: { error_type: 'payment_method_removal_failed' },
      })
      throw error
    } finally {
      span.span.end()
    }
  }

  // Utility methods for checking limits and features
  async checkFeatureAccess(organizationId: string, feature: string): Promise<boolean> {
    const subscription = await this.getOrganizationSubscription(organizationId)
    if (!subscription) {
      return false
    }

    const plan = await this.getSubscriptionPlan(subscription.planId)
    if (!plan) {
      return false
    }

    return plan.features[feature] === true
  }

  async checkUsageLimit(organizationId: string, metric: string, currentUsage: number): Promise<{ allowed: boolean; limit: number; current: number }> {
    const subscription = await this.getOrganizationSubscription(organizationId)
    if (!subscription) {
      return { allowed: false, limit: 0, current: currentUsage }
    }

    const plan = await this.getSubscriptionPlan(subscription.planId)
    if (!plan) {
      return { allowed: false, limit: 0, current: currentUsage }
    }

    const limit = plan.limits[metric] || 0
    return {
      allowed: currentUsage < limit,
      limit,
      current: currentUsage,
    }
  }

  // Mapping methods
  private mapSubscriptionPlan(row: any): SubscriptionPlan {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      priceMonthly: parseFloat(row.price_monthly),
      priceYearly: parseFloat(row.price_yearly),
      currency: row.currency,
      features: row.features || {},
      limits: row.limits || {},
      isActive: row.is_active,
    }
  }

  private mapOrganizationSubscription(row: any): OrganizationSubscription {
    return {
      id: row.id,
      organizationId: row.organization_id,
      planId: row.plan_id,
      status: row.status,
      billingCycle: row.billing_cycle,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      canceledAt: row.canceled_at,
      trialStart: row.trial_start,
      trialEnd: row.trial_end,
    }
  }

  private mapAddonProduct(row: any): AddonProduct {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      priceMonthly: parseFloat(row.price_monthly),
      priceYearly: parseFloat(row.price_yearly),
      currency: row.currency,
      unitType: row.unit_type,
      isActive: row.is_active,
    }
  }

  private mapOrganizationAddon(row: any): OrganizationAddon {
    return {
      id: row.id,
      organizationId: row.organization_id,
      addonId: row.addon_id,
      quantity: row.quantity,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
    }
  }

  private mapUsageMetric(row: any): UsageMetric {
    return {
      id: row.id,
      organizationId: row.organization_id,
      metricName: row.metric_name,
      metricValue: parseFloat(row.metric_value),
      metricDate: row.metric_date,
    }
  }

  private mapUsageEvent(row: any): UsageEvent {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      eventType: row.event_type,
      eventData: row.event_data,
      metricValue: parseFloat(row.metric_value),
      createdAt: row.created_at,
    }
  }

  private mapInvoice(row: any): Invoice {
    return {
      id: row.id,
      organizationId: row.organization_id,
      invoiceNumber: row.invoice_number,
      status: row.status,
      amount: parseFloat(row.amount),
      currency: row.currency,
      taxAmount: parseFloat(row.tax_amount || 0),
      totalAmount: parseFloat(row.total_amount),
      billingPeriodStart: row.billing_period_start,
      billingPeriodEnd: row.billing_period_end,
      dueDate: row.due_date,
      paidAt: row.paid_at,
    }
  }

  private mapInvoiceLineItem(row: any): InvoiceLineItem {
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      description: row.description,
      quantity: parseFloat(row.quantity),
      unitPrice: parseFloat(row.unit_price),
      amount: parseFloat(row.amount),
      metadata: row.metadata,
    }
  }

  private mapBillingInfo(row: any): BillingInfo {
    return {
      id: row.id,
      organizationId: row.organization_id,
      billingEmail: row.billing_email,
      billingAddress: row.billing_address,
      taxId: row.tax_id,
      currency: row.currency,
      timezone: row.timezone,
    }
  }

  private mapPaymentMethod(row: any): PaymentMethod {
    return {
      id: row.id,
      organizationId: row.organization_id,
      type: row.type,
      provider: row.provider,
      providerPaymentMethodId: row.provider_payment_method_id,
      isDefault: row.is_default,
      metadata: row.metadata,
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
      console.error('Billing service health check failed:', error)
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
