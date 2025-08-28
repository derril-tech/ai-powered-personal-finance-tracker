// Created automatically by Cursor AI (2024-12-19)

'use client'

import React, { useState, useEffect } from 'react'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { TabView, TabPanel } from 'primereact/tabview'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { Calendar } from 'primereact/calendar'
import { ProgressBar } from 'primereact/progressbar'
import { Badge } from 'primereact/badge'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface SubscriptionPlan {
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

interface OrganizationSubscription {
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

interface AddonProduct {
  id: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  currency: string
  unitType: 'seats' | 'connections' | 'storage_gb' | 'api_calls' | 'support_tier'
  isActive: boolean
}

interface OrganizationAddon {
  id: string
  organizationId: string
  addonId: string
  quantity: number
  status: 'active' | 'canceled'
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

interface UsageMetric {
  id: string
  organizationId: string
  metricName: string
  metricValue: number
  metricDate: Date
}

interface Invoice {
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

interface BillingInfo {
  id: string
  organizationId: string
  billingEmail: string
  billingAddress?: Record<string, any>
  taxId?: string
  currency: string
  timezone: string
}

interface PaymentMethod {
  id: string
  organizationId: string
  type: 'card' | 'bank_account' | 'paypal'
  provider: string
  providerPaymentMethodId: string
  isDefault: boolean
  metadata?: Record<string, any>
}

const BILLING_CYCLE_OPTIONS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
]

const PAYMENT_TYPE_OPTIONS = [
  { label: 'Credit Card', value: 'card' },
  { label: 'Bank Account', value: 'bank_account' },
  { label: 'PayPal', value: 'paypal' },
]

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [subscriptionDialog, setSubscriptionDialog] = useState(false)
  const [addonDialog, setAddonDialog] = useState(false)
  const [paymentMethodDialog, setPaymentMethodDialog] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [selectedAddon, setSelectedAddon] = useState<AddonProduct | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [addonQuantity, setAddonQuantity] = useState(1)
  const [paymentType, setPaymentType] = useState<'card' | 'bank_account' | 'paypal'>('card')
  const [paymentProvider, setPaymentProvider] = useState('stripe')
  const [paymentMethodId, setPaymentMethodId] = useState('')

  const queryClient = useQueryClient()

  // Queries
  const { data: plans } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get('/billing/plans').then(res => res.data),
  })

  const { data: subscription } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => api.get('/billing/subscription').then(res => res.data),
  })

  const { data: addons } = useQuery({
    queryKey: ['billing', 'addons'],
    queryFn: () => api.get('/billing/addons').then(res => res.data),
  })

  const { data: organizationAddons } = useQuery({
    queryKey: ['billing', 'addons', 'organization'],
    queryFn: () => api.get('/billing/addons/organization').then(res => res.data),
  })

  const { data: currentUsage } = useQuery({
    queryKey: ['billing', 'usage', 'current'],
    queryFn: () => api.get('/billing/usage/current').then(res => res.data),
  })

  const { data: usageMetrics } = useQuery({
    queryKey: ['billing', 'usage', 'metrics'],
    queryFn: () => api.get('/billing/usage/metrics').then(res => res.data),
  })

  const { data: invoices } = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: () => api.get('/billing/invoices').then(res => res.data),
  })

  const { data: billingInfo } = useQuery({
    queryKey: ['billing', 'info'],
    queryFn: () => api.get('/billing/info').then(res => res.data),
  })

  const { data: paymentMethods } = useQuery({
    queryKey: ['billing', 'payment-methods'],
    queryFn: () => api.get('/billing/payment-methods').then(res => res.data),
  })

  // Mutations
  const createSubscriptionMutation = useMutation({
    mutationFn: (data: { planId: string; billingCycle: 'monthly' | 'yearly'; trialDays: number }) =>
      api.post('/billing/subscription', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] })
      setSubscriptionDialog(false)
      setSelectedPlan(null)
    },
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: (cancelAtPeriodEnd: boolean) =>
      api.put('/billing/subscription/cancel', null, { params: { cancelAtPeriodEnd } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] })
    },
  })

  const addAddonMutation = useMutation({
    mutationFn: (data: { addonId: string; quantity: number }) =>
      api.post('/billing/addons', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'addons', 'organization'] })
      setAddonDialog(false)
      setSelectedAddon(null)
    },
  })

  const removeAddonMutation = useMutation({
    mutationFn: (addonId: string) => api.delete(`/billing/addons/${addonId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'addons', 'organization'] })
    },
  })

  const addPaymentMethodMutation = useMutation({
    mutationFn: (data: {
      type: 'card' | 'bank_account' | 'paypal'
      provider: string
      providerPaymentMethodId: string
      isDefault: boolean
    }) => api.post('/billing/payment-methods', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payment-methods'] })
      setPaymentMethodDialog(false)
      setPaymentType('card')
      setPaymentProvider('stripe')
      setPaymentMethodId('')
    },
  })

  const removePaymentMethodMutation = useMutation({
    mutationFn: (paymentMethodId: string) => api.delete(`/billing/payment-methods/${paymentMethodId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payment-methods'] })
    },
  })

  // Handlers
  const handleCreateSubscription = () => {
    if (!selectedPlan) return

    createSubscriptionMutation.mutate({
      planId: selectedPlan.id,
      billingCycle,
      trialDays: 0,
    })
  }

  const handleCancelSubscription = (cancelAtPeriodEnd: boolean = true) => {
    cancelSubscriptionMutation.mutate(cancelAtPeriodEnd)
  }

  const handleAddAddon = () => {
    if (!selectedAddon) return

    addAddonMutation.mutate({
      addonId: selectedAddon.id,
      quantity: addonQuantity,
    })
  }

  const handleRemoveAddon = (addonId: string) => {
    removeAddonMutation.mutate(addonId)
  }

  const handleAddPaymentMethod = () => {
    addPaymentMethodMutation.mutate({
      type: paymentType,
      provider: paymentProvider,
      providerPaymentMethodId: paymentMethodId,
      isDefault: paymentMethods?.length === 0,
    })
  }

  const handleRemovePaymentMethod = (paymentMethodId: string) => {
    removePaymentMethodMutation.mutate(paymentMethodId)
  }

  // Utility functions
  const getCurrentPlan = () => {
    if (!subscription || !plans) return null
    return plans.find((plan: SubscriptionPlan) => plan.id === subscription.planId)
  }

  const getUsagePercentage = (metric: string, current: number) => {
    const plan = getCurrentPlan()
    if (!plan) return 0
    const limit = plan.limits[metric] || 0
    return limit > 0 ? (current / limit) * 100 : 0
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString()
  }

  const getStatusBadge = (status: string) => {
    const severity = {
      active: 'success',
      canceled: 'danger',
      past_due: 'warning',
      unpaid: 'danger',
      draft: 'secondary',
      open: 'warning',
      paid: 'success',
      void: 'danger',
      uncollectible: 'danger',
    }[status] || 'secondary'

    return <Badge value={status} severity={severity} />
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing & Usage</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your subscription, add-ons, and billing information
        </p>
      </div>

      <TabView activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)}>
        {/* Subscription Tab */}
        <TabPanel header="Subscription">
          <div className="grid gap-6">
            {/* Current Subscription */}
            {subscription && (
              <Card>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Current Subscription
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {getCurrentPlan()?.name} - {subscription.billingCycle}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(subscription.status)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Current Period</p>
                    <p className="font-medium">
                      {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Price</p>
                    <p className="font-medium">
                      {formatCurrency(
                        subscription.billingCycle === 'monthly'
                          ? getCurrentPlan()?.priceMonthly || 0
                          : getCurrentPlan()?.priceYearly || 0,
                        getCurrentPlan()?.currency
                      )}
                      /{subscription.billingCycle}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium capitalize">{subscription.status}</p>
                  </div>
                </div>

                {subscription.trialEnd && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Trial ends on {formatDate(subscription.trialEnd)}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    label="Cancel Subscription"
                    icon="pi pi-times"
                    severity="danger"
                    outlined
                    onClick={() => handleCancelSubscription(true)}
                    loading={cancelSubscriptionMutation.isPending}
                  />
                  <Button
                    label="Cancel Immediately"
                    icon="pi pi-trash"
                    severity="danger"
                    outlined
                    onClick={() => handleCancelSubscription(false)}
                    loading={cancelSubscriptionMutation.isPending}
                  />
                </div>
              </Card>
            )}

            {/* Available Plans */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Available Plans</h3>
                <Button
                  label="Change Plan"
                  icon="pi pi-plus"
                  onClick={() => setSubscriptionDialog(true)}
                  disabled={!subscription}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans?.map((plan: SubscriptionPlan) => (
                  <div
                    key={plan.id}
                    className={`p-4 border rounded-lg ${
                      subscription?.planId === plan.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <h4 className="font-semibold text-lg">{plan.name}</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{plan.description}</p>
                    <div className="mb-3">
                      <p className="text-2xl font-bold">
                        {formatCurrency(plan.priceMonthly, plan.currency)}
                        <span className="text-sm font-normal text-gray-500">/month</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        or {formatCurrency(plan.priceYearly, plan.currency)}/year
                      </p>
                    </div>
                    <ul className="text-sm space-y-1 mb-4">
                      {Object.entries(plan.features).map(([key, value]) => (
                        <li key={key} className="flex items-center">
                          <i className="pi pi-check text-green-500 mr-2" />
                          {key}: {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                        </li>
                      ))}
                    </ul>
                    {subscription?.planId !== plan.id && (
                      <Button
                        label="Select Plan"
                        size="small"
                        onClick={() => {
                          setSelectedPlan(plan)
                          setSubscriptionDialog(true)
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabPanel>

        {/* Add-ons Tab */}
        <TabPanel header="Add-ons">
          <div className="grid gap-6">
            {/* Current Add-ons */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Current Add-ons</h3>
                <Button
                  label="Add Add-on"
                  icon="pi pi-plus"
                  onClick={() => setAddonDialog(true)}
                />
              </div>

              <DataTable value={organizationAddons || []} emptyMessage="No add-ons active">
                <Column field="addonId" header="Add-on" />
                <Column field="quantity" header="Quantity" />
                <Column field="status" header="Status" body={(rowData) => getStatusBadge(rowData.status)} />
                <Column
                  header="Actions"
                  body={(rowData) => (
                    <Button
                      label="Remove"
                      icon="pi pi-trash"
                      size="small"
                      severity="danger"
                      outlined
                      onClick={() => handleRemoveAddon(rowData.addonId)}
                      loading={removeAddonMutation.isPending}
                    />
                  )}
                />
              </DataTable>
            </Card>

            {/* Available Add-ons */}
            <Card>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Available Add-ons</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addons?.map((addon: AddonProduct) => (
                  <div key={addon.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h4 className="font-semibold">{addon.name}</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{addon.description}</p>
                    <div className="mb-3">
                      <p className="text-lg font-bold">
                        {formatCurrency(addon.priceMonthly, addon.currency)}
                        <span className="text-sm font-normal text-gray-500">/month</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        or {formatCurrency(addon.priceYearly, addon.currency)}/year
                      </p>
                    </div>
                    <Button
                      label="Add Add-on"
                      size="small"
                      onClick={() => {
                        setSelectedAddon(addon)
                        setAddonDialog(true)
                      }}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabPanel>

        {/* Usage Tab */}
        <TabPanel header="Usage">
          <div className="grid gap-6">
            {/* Current Usage */}
            <Card>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current Usage (Last 30 Days)</h3>
              <div className="space-y-4">
                {currentUsage && Object.entries(currentUsage).map(([metric, value]) => {
                  const percentage = getUsagePercentage(metric, value as number)
                  const plan = getCurrentPlan()
                  const limit = plan?.limits[metric] || 0

                  return (
                    <div key={metric} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium capitalize">{metric.replace(/_/g, ' ')}</span>
                        <span className="text-sm text-gray-500">
                          {value} / {limit > 0 ? limit : 'Unlimited'}
                        </span>
                      </div>
                      <ProgressBar value={percentage} />
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Usage History */}
            <Card>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Usage History</h3>
              <DataTable value={usageMetrics || []} emptyMessage="No usage data available">
                <Column field="metricName" header="Metric" />
                <Column field="metricValue" header="Value" />
                <Column
                  field="metricDate"
                  header="Date"
                  body={(rowData) => formatDate(rowData.metricDate)}
                />
              </DataTable>
            </Card>
          </div>
        </TabPanel>

        {/* Invoices Tab */}
        <TabPanel header="Invoices">
          <Card>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Invoice History</h3>
            <DataTable value={invoices || []} emptyMessage="No invoices found">
              <Column field="invoiceNumber" header="Invoice #" />
              <Column field="status" header="Status" body={(rowData) => getStatusBadge(rowData.status)} />
              <Column
                field="totalAmount"
                header="Amount"
                body={(rowData) => formatCurrency(rowData.totalAmount, rowData.currency)}
              />
              <Column
                field="billingPeriodStart"
                header="Period"
                body={(rowData) => (
                  <span>
                    {formatDate(rowData.billingPeriodStart)} - {formatDate(rowData.billingPeriodEnd)}
                  </span>
                )}
              />
              <Column
                field="dueDate"
                header="Due Date"
                body={(rowData) => formatDate(rowData.dueDate)}
              />
              <Column
                header="Actions"
                body={(rowData) => (
                  <Button
                    label="View"
                    icon="pi pi-eye"
                    size="small"
                    outlined
                    onClick={() => window.open(`/billing/invoices/${rowData.id}`, '_blank')}
                  />
                )}
              />
            </DataTable>
          </Card>
        </TabPanel>

        {/* Payment Methods Tab */}
        <TabPanel header="Payment Methods">
          <div className="grid gap-6">
            {/* Current Payment Methods */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Payment Methods</h3>
                <Button
                  label="Add Payment Method"
                  icon="pi pi-plus"
                  onClick={() => setPaymentMethodDialog(true)}
                />
              </div>

              <DataTable value={paymentMethods || []} emptyMessage="No payment methods found">
                <Column field="type" header="Type" body={(rowData) => rowData.type.toUpperCase()} />
                <Column field="provider" header="Provider" />
                <Column
                  field="isDefault"
                  header="Default"
                  body={(rowData) => (rowData.isDefault ? 'Yes' : 'No')}
                />
                <Column
                  header="Actions"
                  body={(rowData) => (
                    <div className="flex gap-2">
                      {!rowData.isDefault && (
                        <Button
                          label="Set Default"
                          icon="pi pi-star"
                          size="small"
                          outlined
                        />
                      )}
                      <Button
                        label="Remove"
                        icon="pi pi-trash"
                        size="small"
                        severity="danger"
                        outlined
                        onClick={() => handleRemovePaymentMethod(rowData.id)}
                        loading={removePaymentMethodMutation.isPending}
                      />
                    </div>
                  )}
                />
              </DataTable>
            </Card>

            {/* Billing Information */}
            <Card>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Billing Information</h3>
              {billingInfo ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Billing Email</p>
                    <p className="font-medium">{billingInfo.billingEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Currency</p>
                    <p className="font-medium">{billingInfo.currency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Timezone</p>
                    <p className="font-medium">{billingInfo.timezone}</p>
                  </div>
                  {billingInfo.billingAddress && (
                    <div>
                      <p className="text-sm text-gray-500">Billing Address</p>
                      <p className="font-medium">
                        {billingInfo.billingAddress.line1}
                        {billingInfo.billingAddress.line2 && <br />}
                        {billingInfo.billingAddress.line2}
                        <br />
                        {billingInfo.billingAddress.city}, {billingInfo.billingAddress.state}{' '}
                        {billingInfo.billingAddress.postalCode}
                        <br />
                        {billingInfo.billingAddress.country}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No billing information available</p>
              )}
            </Card>
          </div>
        </TabPanel>
      </TabView>

      {/* Subscription Dialog */}
      <Dialog
        visible={subscriptionDialog}
        onHide={() => setSubscriptionDialog(false)}
        header="Change Subscription"
        modal
        className="w-full max-w-md"
      >
        {selectedPlan && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold">{selectedPlan.name}</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{selectedPlan.description}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Billing Cycle</label>
              <Dropdown
                value={billingCycle}
                options={BILLING_CYCLE_OPTIONS}
                onChange={(e) => setBillingCycle(e.value)}
                placeholder="Select billing cycle"
                className="w-full"
              />
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formatCurrency(
                  billingCycle === 'monthly' ? selectedPlan.priceMonthly : selectedPlan.priceYearly,
                  selectedPlan.currency
                )}
                /{billingCycle}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                label="Cancel"
                outlined
                onClick={() => setSubscriptionDialog(false)}
                className="flex-1"
              />
              <Button
                label="Change Plan"
                onClick={handleCreateSubscription}
                loading={createSubscriptionMutation.isPending}
                className="flex-1"
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* Add-on Dialog */}
      <Dialog
        visible={addonDialog}
        onHide={() => setAddonDialog(false)}
        header="Add Add-on"
        modal
        className="w-full max-w-md"
      >
        {selectedAddon && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold">{selectedAddon.name}</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{selectedAddon.description}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Quantity</label>
              <InputNumber
                value={addonQuantity}
                onValueChange={(e) => setAddonQuantity(e.value || 1)}
                min={1}
                className="w-full"
              />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">
                {formatCurrency(selectedAddon.priceMonthly * addonQuantity, selectedAddon.currency)}/month
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                label="Cancel"
                outlined
                onClick={() => setAddonDialog(false)}
                className="flex-1"
              />
              <Button
                label="Add Add-on"
                onClick={handleAddAddon}
                loading={addAddonMutation.isPending}
                className="flex-1"
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog
        visible={paymentMethodDialog}
        onHide={() => setPaymentMethodDialog(false)}
        header="Add Payment Method"
        modal
        className="w-full max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Payment Type</label>
            <Dropdown
              value={paymentType}
              options={PAYMENT_TYPE_OPTIONS}
              onChange={(e) => setPaymentType(e.value)}
              placeholder="Select payment type"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Provider</label>
            <InputText
              value={paymentProvider}
              onChange={(e) => setPaymentProvider(e.target.value)}
              placeholder="e.g., Stripe, PayPal"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Payment Method ID</label>
            <InputText
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              placeholder="Payment method identifier"
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <Button
              label="Cancel"
              outlined
              onClick={() => setPaymentMethodDialog(false)}
              className="flex-1"
            />
            <Button
              label="Add Payment Method"
              onClick={handleAddPaymentMethod}
              loading={addPaymentMethodMutation.isPending}
              className="flex-1"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
