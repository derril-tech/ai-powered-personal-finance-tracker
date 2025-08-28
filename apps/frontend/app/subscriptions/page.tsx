// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { Badge } from 'primereact/badge'
import { ProgressSpinner } from 'primereact/progressspinner'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiPlus, 
  PiPencil, 
  PiTrash, 
  PiWarning,
  PiTrendingUp,
  PiTrendingDown,
  PiCalendar,
  PiCreditCard,
  PiCheckCircle,
  PiXCircle,
  PiInfo,
  PiLightbulb
} from 'react-icons/pi'

interface Subscription {
  id: string
  merchant: string
  amount: number
  currency: string
  cadenceType: 'daily' | 'weekly' | 'monthly' | 'yearly'
  cadenceValue: number
  nextDue: Date
  lastOccurrence: Date
  isActive: boolean
  confidenceScore: number
  priceHikeDetected: boolean
  missedPayment: boolean
  riskScore: number
  accountId: string
  accountName: string
  categoryId: string
  categoryName: string
  categoryColor: string
  createdAt: Date
  updatedAt: Date
}

interface CancelTip {
  subscriptionId: string
  tip: string
  potentialSavings: number
  difficulty: 'easy' | 'medium' | 'hard'
}

const CADENCE_TYPES = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
]

export default function SubscriptionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useRef<Toast>(null)
  
  // State
  const [showCancelTips, setShowCancelTips] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)

  // Fetch data
  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery<Subscription[]>(
    'subscriptions',
    () => api.get('/recurring-transactions').then(res => res.data),
    { refetchInterval: 30000 }
  )

  const { data: cancelTips, isLoading: cancelTipsLoading } = useQuery<CancelTip[]>(
    'cancel-tips',
    () => api.get('/recurring-transactions/cancel-tips').then(res => res.data),
    { refetchInterval: 300000 }
  )

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return format(new Date(date), 'MMM dd, yyyy')
  }

  const getCadenceLabel = (type: string, value: number) => {
    switch (type) {
      case 'daily':
        return 'Daily'
      case 'weekly':
        return value === 1 ? 'Weekly' : `Every ${value} weeks`
      case 'monthly':
        return value === 1 ? 'Monthly' : `Every ${value} months`
      case 'yearly':
        return value === 1 ? 'Yearly' : `Every ${value} years`
      default:
        return 'Unknown'
    }
  }

  const getRiskColor = (score: number) => {
    if (score >= 0.8) return 'danger'
    if (score >= 0.5) return 'warning'
    return 'success'
  }

  const getRiskLabel = (score: number) => {
    if (score >= 0.8) return 'High Risk'
    if (score >= 0.5) return 'Medium Risk'
    return 'Low Risk'
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'success'
    if (score >= 0.7) return 'warning'
    return 'danger'
  }

  const getDaysUntilDue = (nextDue: Date) => {
    const now = new Date()
    const due = new Date(nextDue)
    const diffTime = due.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getDueStatus = (nextDue: Date) => {
    const daysUntilDue = getDaysUntilDue(nextDue)
    if (daysUntilDue < 0) return { status: 'overdue', color: 'danger', label: 'Overdue' }
    if (daysUntilDue <= 7) return { status: 'due_soon', color: 'warning', label: 'Due Soon' }
    return { status: 'upcoming', color: 'info', label: 'Upcoming' }
  }

  const activeSubscriptions = subscriptions?.filter(s => s.isActive) || []
  const totalMonthlyCost = activeSubscriptions.reduce((sum, sub) => {
    if (sub.cadenceType === 'monthly') return sum + sub.amount
    if (sub.cadenceType === 'yearly') return sum + (sub.amount / 12)
    if (sub.cadenceType === 'weekly') return sum + (sub.amount * 4.33)
    return sum + sub.amount
  }, 0)

  const priceHikes = activeSubscriptions.filter(s => s.priceHikeDetected)
  const missedPayments = activeSubscriptions.filter(s => s.missedPayment)
  const highRisk = activeSubscriptions.filter(s => s.riskScore >= 0.8)

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Subscriptions
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track and manage your recurring payments
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              label="Cancel Tips"
              icon={<PiLightbulb className="w-4 h-4" />}
              className="p-button-outlined"
              onClick={() => setShowCancelTips(true)}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Active Subscriptions
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {activeSubscriptions.length}
                </p>
              </div>
              <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <PiCreditCard className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Monthly Cost
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(totalMonthlyCost)}
                </p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-900 rounded-lg">
                <PiTrendingDown className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Price Hikes
                </p>
                <p className="text-2xl font-bold text-warning-600">
                  {priceHikes.length}
                </p>
              </div>
              <div className="p-3 bg-warning-100 dark:bg-warning-900 rounded-lg">
                <PiTrendingUp className="w-6 h-6 text-warning-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  High Risk
                </p>
                <p className="text-2xl font-bold text-danger-600">
                  {highRisk.length}
                </p>
              </div>
              <div className="p-3 bg-danger-100 dark:bg-danger-900 rounded-lg">
                <PiWarning className="w-6 h-6 text-danger-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Subscriptions Table */}
        <Card title="Active Subscriptions" className="card">
          {subscriptionsLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : activeSubscriptions.length > 0 ? (
            <DataTable value={activeSubscriptions} className="p-datatable-sm">
              <Column 
                field="merchant" 
                header="Merchant" 
                body={(rowData) => (
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: rowData.categoryColor }}
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {rowData.merchant}
                      </p>
                      <p className="text-sm text-gray-500">
                        {rowData.categoryName}
                      </p>
                    </div>
                  </div>
                )}
              />
              
              <Column 
                field="amount" 
                header="Amount" 
                body={(rowData) => (
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(rowData.amount, rowData.currency)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {getCadenceLabel(rowData.cadenceType, rowData.cadenceValue)}
                    </p>
                  </div>
                )}
              />
              
              <Column 
                field="nextDue" 
                header="Next Due" 
                body={(rowData) => {
                  const dueStatus = getDueStatus(rowData.nextDue)
                  const daysUntilDue = getDaysUntilDue(rowData.nextDue)
                  
                  return (
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {formatDate(rowData.nextDue)}
                      </p>
                      <Badge 
                        value={`${dueStatus.label} (${Math.abs(daysUntilDue)} days)`}
                        severity={dueStatus.color}
                      />
                    </div>
                  )
                }}
              />
              
              <Column 
                field="confidenceScore" 
                header="Confidence" 
                body={(rowData) => (
                  <Badge 
                    value={`${(rowData.confidenceScore * 100).toFixed(0)}%`}
                    severity={getConfidenceColor(rowData.confidenceScore)}
                  />
                )}
              />
              
              <Column 
                field="riskScore" 
                header="Risk" 
                body={(rowData) => (
                  <Badge 
                    value={getRiskLabel(rowData.riskScore)}
                    severity={getRiskColor(rowData.riskScore)}
                  />
                )}
              />
              
              <Column 
                header="Flags" 
                body={(rowData) => (
                  <div className="flex space-x-1">
                    {rowData.priceHikeDetected && (
                      <Badge value="Price Hike" severity="warning" />
                    )}
                    {rowData.missedPayment && (
                      <Badge value="Missed" severity="danger" />
                    )}
                  </div>
                )}
              />
              
              <Column 
                header="Actions" 
                body={(rowData) => (
                  <div className="flex space-x-1">
                    <Button
                      icon={<PiPencil className="w-3 h-3" />}
                      size="small"
                      className="p-button-text p-button-sm"
                      tooltip="Edit"
                    />
                    <Button
                      icon={<PiTrash className="w-3 h-3" />}
                      size="small"
                      className="p-button-text p-button-sm"
                      tooltip="Cancel"
                    />
                  </div>
                )}
              />
            </DataTable>
          ) : (
            <div className="text-center py-12">
              <PiCreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Active Subscriptions
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your recurring transactions will appear here once detected
              </p>
            </div>
          )}
        </Card>

        {/* Alerts */}
        {(priceHikes.length > 0 || missedPayments.length > 0 || highRisk.length > 0) && (
          <Card title="Alerts" className="card">
            <div className="space-y-4">
              {priceHikes.map((subscription) => (
                <div key={subscription.id} className="flex items-center justify-between p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <PiTrendingUp className="w-5 h-5 text-warning-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        Price hike detected for {subscription.merchant}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Amount increased to {formatCurrency(subscription.amount, subscription.currency)}
                      </p>
                    </div>
                  </div>
                  <Button
                    label="Review"
                    size="small"
                    className="p-button-outlined p-button-sm"
                  />
                </div>
              ))}

              {missedPayments.map((subscription) => (
                <div key={subscription.id} className="flex items-center justify-between p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <PiXCircle className="w-5 h-5 text-danger-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        Missed payment for {subscription.merchant}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Payment was due on {formatDate(subscription.nextDue)}
                      </p>
                    </div>
                  </div>
                  <Button
                    label="Review"
                    size="small"
                    className="p-button-outlined p-button-sm"
                  />
                </div>
              ))}

              {highRisk.map((subscription) => (
                <div key={subscription.id} className="flex items-center justify-between p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <PiWarning className="w-5 h-5 text-danger-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        High risk subscription: {subscription.merchant}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Consider reviewing this subscription
                      </p>
                    </div>
                  </div>
                  <Button
                    label="Review"
                    size="small"
                    className="p-button-outlined p-button-sm"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Cancel Tips Dialog */}
        <Dialog
          visible={showCancelTips}
          onHide={() => setShowCancelTips(false)}
          header="Subscription Cancel Tips"
          modal
          className="p-fluid"
          style={{ width: '800px' }}
        >
          {cancelTipsLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : cancelTips && cancelTips.length > 0 ? (
            <div className="space-y-4">
              {cancelTips.map((tip) => {
                const subscription = subscriptions?.find(s => s.id === tip.subscriptionId)
                if (!subscription) return null

                return (
                  <div key={tip.subscriptionId} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {subscription.merchant}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatCurrency(subscription.amount, subscription.currency)} / {getCadenceLabel(subscription.cadenceType, subscription.cadenceValue)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-success-600">
                          Save {formatCurrency(tip.potentialSavings)}/year
                        </p>
                        <Badge 
                          value={tip.difficulty.toUpperCase()} 
                          severity={tip.difficulty === 'easy' ? 'success' : tip.difficulty === 'medium' ? 'warning' : 'danger'}
                        />
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">
                      {tip.tip}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <PiLightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No cancel tips available at the moment
              </p>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button
              label="Close"
              onClick={() => setShowCancelTips(false)}
            />
          </div>
        </Dialog>
      </div>
    </MainLayout>
  )
}
