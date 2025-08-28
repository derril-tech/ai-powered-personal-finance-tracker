// Created automatically by Cursor AI (2024-12-19)

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger'
import { z } from 'zod'
import { BillingService } from './billing.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '../auth/enums/user-role.enum'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'

// DTOs
const CreateSubscriptionDto = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  trialDays: z.number().min(0).max(30).default(0),
})

const UpdateBillingInfoDto = z.object({
  billingEmail: z.string().email(),
  billingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }).optional(),
  taxId: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  timezone: z.string().default('UTC'),
})

const AddAddonDto = z.object({
  addonId: z.string().uuid(),
  quantity: z.number().min(1).default(1),
})

const AddPaymentMethodDto = z.object({
  type: z.enum(['card', 'bank_account', 'paypal']),
  provider: z.string(),
  providerPaymentMethodId: z.string(),
  isDefault: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
})

const RecordUsageEventDto = z.object({
  eventType: z.string(),
  metricValue: z.number().min(0).default(1),
  eventData: z.record(z.any()).optional(),
})

type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionDto>
type UpdateBillingInfoDto = z.infer<typeof UpdateBillingInfoDto>
type AddAddonDto = z.infer<typeof AddAddonDto>
type AddPaymentMethodDto = z.infer<typeof AddPaymentMethodDto>
type RecordUsageEventDto = z.infer<typeof RecordUsageEventDto>

@ApiTags('Billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Subscription Plans
  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  @ApiResponse({ status: 200, description: 'List of subscription plans' })
  async getSubscriptionPlans() {
    return this.billingService.getSubscriptionPlans()
  }

  @Get('plans/:planId')
  @ApiOperation({ summary: 'Get subscription plan details' })
  @ApiParam({ name: 'planId', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Subscription plan details' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getSubscriptionPlan(@Param('planId') planId: string) {
    const plan = await this.billingService.getSubscriptionPlan(planId)
    if (!plan) {
      throw new Error('Plan not found')
    }
    return plan
  }

  // Organization Subscriptions
  @Get('subscription')
  @ApiOperation({ summary: 'Get organization subscription' })
  @ApiResponse({ status: 200, description: 'Organization subscription details' })
  @ApiResponse({ status: 404, description: 'No subscription found' })
  async getSubscription(@Request() req: any) {
    const subscription = await this.billingService.getOrganizationSubscription(req.user.organizationId)
    if (!subscription) {
      throw new Error('No subscription found')
    }
    return subscription
  }

  @Post('subscription')
  @ApiOperation({ summary: 'Create organization subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async createSubscription(
    @Request() req: any,
    @Body(new ZodValidationPipe(CreateSubscriptionDto)) createSubscriptionDto: CreateSubscriptionDto
  ) {
    return this.billingService.createSubscription(
      req.user.organizationId,
      createSubscriptionDto.planId,
      createSubscriptionDto.billingCycle,
      createSubscriptionDto.trialDays
    )
  }

  @Put('subscription/cancel')
  @ApiOperation({ summary: 'Cancel organization subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled successfully' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async cancelSubscription(
    @Request() req: any,
    @Query('cancelAtPeriodEnd') cancelAtPeriodEnd: string = 'true'
  ) {
    return this.billingService.cancelSubscription(
      req.user.organizationId,
      cancelAtPeriodEnd === 'true'
    )
  }

  // Add-ons
  @Get('addons')
  @ApiOperation({ summary: 'Get available add-on products' })
  @ApiResponse({ status: 200, description: 'List of add-on products' })
  async getAddonProducts() {
    return this.billingService.getAddonProducts()
  }

  @Get('addons/organization')
  @ApiOperation({ summary: 'Get organization add-ons' })
  @ApiResponse({ status: 200, description: 'Organization add-ons' })
  async getOrganizationAddons(@Request() req: any) {
    return this.billingService.getOrganizationAddons(req.user.organizationId)
  }

  @Post('addons')
  @ApiOperation({ summary: 'Add add-on to organization' })
  @ApiResponse({ status: 201, description: 'Add-on added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async addAddon(
    @Request() req: any,
    @Body(new ZodValidationPipe(AddAddonDto)) addAddonDto: AddAddonDto
  ) {
    return this.billingService.addAddon(
      req.user.organizationId,
      addAddonDto.addonId,
      addAddonDto.quantity
    )
  }

  @Delete('addons/:addonId')
  @ApiOperation({ summary: 'Remove add-on from organization' })
  @ApiParam({ name: 'addonId', description: 'Add-on ID' })
  @ApiResponse({ status: 204, description: 'Add-on removed successfully' })
  @ApiResponse({ status: 404, description: 'Add-on not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAddon(
    @Request() req: any,
    @Param('addonId') addonId: string
  ) {
    await this.billingService.removeAddon(req.user.organizationId, addonId)
  }

  // Usage Tracking
  @Post('usage/events')
  @ApiOperation({ summary: 'Record usage event' })
  @ApiResponse({ status: 201, description: 'Usage event recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async recordUsageEvent(
    @Request() req: any,
    @Body(new ZodValidationPipe(RecordUsageEventDto)) recordUsageEventDto: RecordUsageEventDto
  ) {
    await this.billingService.recordUsageEvent(
      req.user.organizationId,
      recordUsageEventDto.eventType,
      recordUsageEventDto.metricValue,
      req.user.userId,
      recordUsageEventDto.eventData
    )
    return { message: 'Usage event recorded successfully' }
  }

  @Get('usage/metrics')
  @ApiOperation({ summary: 'Get usage metrics' })
  @ApiQuery({ name: 'metricName', required: false, description: 'Filter by metric name' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Usage metrics' })
  async getUsageMetrics(
    @Request() req: any,
    @Query('metricName') metricName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.billingService.getUsageMetrics(
      req.user.organizationId,
      metricName,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    )
  }

  @Get('usage/current')
  @ApiOperation({ summary: 'Get current usage (last 30 days)' })
  @ApiResponse({ status: 200, description: 'Current usage summary' })
  async getCurrentUsage(@Request() req: any) {
    return this.billingService.getCurrentUsage(req.user.organizationId)
  }

  // Billing Info
  @Get('info')
  @ApiOperation({ summary: 'Get organization billing info' })
  @ApiResponse({ status: 200, description: 'Billing info' })
  @ApiResponse({ status: 404, description: 'Billing info not found' })
  async getBillingInfo(@Request() req: any) {
    const billingInfo = await this.billingService.getBillingInfo(req.user.organizationId)
    if (!billingInfo) {
      throw new Error('Billing info not found')
    }
    return billingInfo
  }

  @Put('info')
  @ApiOperation({ summary: 'Update organization billing info' })
  @ApiResponse({ status: 200, description: 'Billing info updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async updateBillingInfo(
    @Request() req: any,
    @Body(new ZodValidationPipe(UpdateBillingInfoDto)) updateBillingInfoDto: UpdateBillingInfoDto
  ) {
    return this.billingService.updateBillingInfo(
      req.user.organizationId,
      updateBillingInfoDto.billingEmail,
      updateBillingInfoDto.billingAddress,
      updateBillingInfoDto.taxId,
      updateBillingInfoDto.currency,
      updateBillingInfoDto.timezone
    )
  }

  // Invoices
  @Get('invoices')
  @ApiOperation({ summary: 'Get organization invoices' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of invoices to return', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of invoices to skip', type: Number })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  async getInvoices(
    @Request() req: any,
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0'
  ) {
    return this.billingService.getInvoices(
      req.user.organizationId,
      parseInt(limit),
      parseInt(offset)
    )
  }

  @Get('invoices/:invoiceId')
  @ApiOperation({ summary: 'Get invoice details' })
  @ApiParam({ name: 'invoiceId', description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(
    @Request() req: any,
    @Param('invoiceId') invoiceId: string
  ) {
    const invoice = await this.billingService.getInvoice(invoiceId, req.user.organizationId)
    if (!invoice) {
      throw new Error('Invoice not found')
    }
    return invoice
  }

  @Get('invoices/:invoiceId/line-items')
  @ApiOperation({ summary: 'Get invoice line items' })
  @ApiParam({ name: 'invoiceId', description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice line items' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoiceLineItems(
    @Request() req: any,
    @Param('invoiceId') invoiceId: string
  ) {
    // First verify the invoice belongs to the organization
    const invoice = await this.billingService.getInvoice(invoiceId, req.user.organizationId)
    if (!invoice) {
      throw new Error('Invoice not found')
    }
    
    return this.billingService.getInvoiceLineItems(invoiceId)
  }

  // Payment Methods
  @Get('payment-methods')
  @ApiOperation({ summary: 'Get organization payment methods' })
  @ApiResponse({ status: 200, description: 'List of payment methods' })
  async getPaymentMethods(@Request() req: any) {
    return this.billingService.getPaymentMethods(req.user.organizationId)
  }

  @Post('payment-methods')
  @ApiOperation({ summary: 'Add payment method to organization' })
  @ApiResponse({ status: 201, description: 'Payment method added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async addPaymentMethod(
    @Request() req: any,
    @Body(new ZodValidationPipe(AddPaymentMethodDto)) addPaymentMethodDto: AddPaymentMethodDto
  ) {
    return this.billingService.addPaymentMethod(
      req.user.organizationId,
      addPaymentMethodDto.type,
      addPaymentMethodDto.provider,
      addPaymentMethodDto.providerPaymentMethodId,
      addPaymentMethodDto.isDefault,
      addPaymentMethodDto.metadata
    )
  }

  @Delete('payment-methods/:paymentMethodId')
  @ApiOperation({ summary: 'Remove payment method from organization' })
  @ApiParam({ name: 'paymentMethodId', description: 'Payment method ID' })
  @ApiResponse({ status: 204, description: 'Payment method removed successfully' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePaymentMethod(
    @Request() req: any,
    @Param('paymentMethodId') paymentMethodId: string
  ) {
    await this.billingService.removePaymentMethod(paymentMethodId, req.user.organizationId)
  }

  // Feature and Limit Checks
  @Get('features/:feature')
  @ApiOperation({ summary: 'Check feature access' })
  @ApiParam({ name: 'feature', description: 'Feature name' })
  @ApiResponse({ status: 200, description: 'Feature access status' })
  async checkFeatureAccess(
    @Request() req: any,
    @Param('feature') feature: string
  ) {
    const hasAccess = await this.billingService.checkFeatureAccess(req.user.organizationId, feature)
    return { hasAccess }
  }

  @Get('limits/:metric')
  @ApiOperation({ summary: 'Check usage limit' })
  @ApiParam({ name: 'metric', description: 'Metric name' })
  @ApiQuery({ name: 'currentUsage', required: true, description: 'Current usage value', type: Number })
  @ApiResponse({ status: 200, description: 'Usage limit status' })
  async checkUsageLimit(
    @Request() req: any,
    @Param('metric') metric: string,
    @Query('currentUsage') currentUsage: string
  ) {
    return this.billingService.checkUsageLimit(
      req.user.organizationId,
      metric,
      parseFloat(currentUsage)
    )
  }

  // Admin endpoints (organization admins only)
  @Get('admin/usage/:organizationId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get usage metrics for organization (admin only)' })
  @ApiParam({ name: 'organizationId', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Usage metrics for organization' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getOrganizationUsage(
    @Param('organizationId') organizationId: string,
    @Query('metricName') metricName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.billingService.getUsageMetrics(
      organizationId,
      metricName,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    )
  }

  @Post('admin/usage/:organizationId/events')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Record usage event for organization (admin only)' })
  @ApiParam({ name: 'organizationId', description: 'Organization ID' })
  @ApiResponse({ status: 201, description: 'Usage event recorded successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async recordOrganizationUsageEvent(
    @Param('organizationId') organizationId: string,
    @Body(new ZodValidationPipe(RecordUsageEventDto)) recordUsageEventDto: RecordUsageEventDto
  ) {
    await this.billingService.recordUsageEvent(
      organizationId,
      recordUsageEventDto.eventType,
      recordUsageEventDto.metricValue,
      undefined, // No specific user for admin operations
      recordUsageEventDto.eventData
    )
    return { message: 'Usage event recorded successfully' }
  }
}
