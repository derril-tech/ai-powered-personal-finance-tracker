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
import { Dropdown } from 'primereact/dropdown'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiWarning, 
  PiCheckCircle, 
  PiXCircle, 
  PiBell,
  PiEye,
  PiEyeSlash,
  PiClock,
  PiTag,
  PiDotsThreeVertical,
  PiFunnel,
  PiTrash
} from 'react-icons/pi'

interface Alert {
  id: string
  type: 'anomaly' | 'budget' | 'bill' | 'low_balance' | 'goal'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  transactionId?: string
  merchant?: string
  amount?: number
  currency?: string
  categoryId?: string
  categoryName?: string
  accountId?: string
  accountName?: string
  isRead: boolean
  isResolved: boolean
  snoozedUntil?: Date
  createdAt: Date
  updatedAt: Date
}

interface Category {
  id: string
  name: string
  color: string
}

const ALERT_TYPES = [
  { label: 'All Alerts', value: 'all' },
  { label: 'Anomalies', value: 'anomaly' },
  { label: 'Budget', value: 'budget' },
  { label: 'Bills', value: 'bill' },
  { label: 'Low Balance', value: 'low_balance' },
  { label: 'Goals', value: 'goal' },
]

const SEVERITY_LEVELS = [
  { label: 'All Severities', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
]

const SNOOZE_OPTIONS = [
  { label: '1 hour', value: 1 },
  { label: '3 hours', value: 3 },
  { label: '1 day', value: 24 },
  { label: '3 days', value: 72 },
  { label: '1 week', value: 168 },
]

export default function AlertsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useRef<Toast>(null)
  
  // State
  const [selectedType, setSelectedType] = useState('all')
  const [selectedSeverity, setSelectedSeverity] = useState('all')
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [snoozeHours, setSnoozeHours] = useState(24)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  // Fetch data
  const { data: alerts, isLoading: alertsLoading } = useQuery<Alert[]>(
    ['alerts', selectedType, selectedSeverity],
    () => {
      const params = new URLSearchParams()
      if (selectedType !== 'all') params.append('type', selectedType)
      if (selectedSeverity !== 'all') params.append('severity', selectedSeverity)
      return api.get(`/alerts?${params.toString()}`).then(res => res.data)
    },
    { refetchInterval: 30000 }
  )

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>(
    'categories',
    () => api.get('/categories').then(res => res.data),
    { refetchInterval: 300000 }
  )

  // Mutations
  const markAsReadMutation = useMutation(
    (alertId: string) => api.put(`/alerts/${alertId}/read`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('alerts')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Alert marked as read',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to mark alert as read',
        })
      },
    }
  )

  const resolveAlertMutation = useMutation(
    (alertId: string) => api.put(`/alerts/${alertId}/resolve`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('alerts')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Alert resolved',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to resolve alert',
        })
      },
    }
  )

  const snoozeAlertMutation = useMutation(
    (data: { alertId: string; hours: number }) => api.put(`/alerts/${data.alertId}/snooze`, { hours: data.hours }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('alerts')
        setShowSnoozeDialog(false)
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Alert snoozed',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to snooze alert',
        })
      },
    }
  )

  const updateCategoryMutation = useMutation(
    (data: { transactionId: string; categoryId: string }) => 
      api.put(`/transactions/${data.transactionId}/categorize`, { category_id: data.categoryId }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('alerts')
        setShowCategoryDialog(false)
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Transaction categorized',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to categorize transaction',
        })
      },
    }
  )

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return format(new Date(date), 'MMM dd, yyyy HH:mm')
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'danger'
      case 'high':
        return 'danger'
      case 'medium':
        return 'warning'
      case 'low':
        return 'info'
      default:
        return 'info'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'anomaly':
        return <PiWarning className="w-4 h-4 text-warning-600" />
      case 'budget':
        return <PiBell className="w-4 h-4 text-danger-600" />
      case 'bill':
        return <PiClock className="w-4 h-4 text-info-600" />
      case 'low_balance':
        return <PiXCircle className="w-4 h-4 text-danger-600" />
      case 'goal':
        return <PiCheckCircle className="w-4 h-4 text-success-600" />
      default:
        return <PiBell className="w-4 h-4 text-gray-600" />
    }
  }

  const handleMarkAsRead = (alertId: string) => {
    markAsReadMutation.mutate(alertId)
  }

  const handleResolve = (alertId: string) => {
    resolveAlertMutation.mutate(alertId)
  }

  const handleSnooze = () => {
    if (!selectedAlert) return
    snoozeAlertMutation.mutate({ alertId: selectedAlert.id, hours: snoozeHours })
  }

  const handleCategorize = () => {
    if (!selectedAlert?.transactionId || !selectedCategory) return
    updateCategoryMutation.mutate({ 
      transactionId: selectedAlert.transactionId, 
      categoryId: selectedCategory 
    })
  }

  const filteredAlerts = alerts || []
  const unreadAlerts = filteredAlerts.filter(alert => !alert.isRead)
  const criticalAlerts = filteredAlerts.filter(alert => alert.severity === 'critical')
  const resolvedAlerts = filteredAlerts.filter(alert => alert.isResolved)

  const categoryOptions = categories?.map(cat => ({
    label: cat.name,
    value: cat.id,
  })) || []

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Alerts Center
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your financial alerts and notifications
            </p>
          </div>
          <div className="flex space-x-2">
            <Dropdown
              value={selectedType}
              options={ALERT_TYPES}
              onChange={(e) => setSelectedType(e.value)}
              className="w-32"
            />
            <Dropdown
              value={selectedSeverity}
              options={SEVERITY_LEVELS}
              onChange={(e) => setSelectedSeverity(e.value)}
              className="w-40"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Alerts
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {filteredAlerts.length}
                </p>
              </div>
              <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <PiBell className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Unread
                </p>
                <p className="text-2xl font-bold text-warning-600">
                  {unreadAlerts.length}
                </p>
              </div>
              <div className="p-3 bg-warning-100 dark:bg-warning-900 rounded-lg">
                <PiEyeSlash className="w-6 h-6 text-warning-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Critical
                </p>
                <p className="text-2xl font-bold text-danger-600">
                  {criticalAlerts.length}
                </p>
              </div>
              <div className="p-3 bg-danger-100 dark:bg-danger-900 rounded-lg">
                <PiWarning className="w-6 h-6 text-danger-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Resolved
                </p>
                <p className="text-2xl font-bold text-success-600">
                  {resolvedAlerts.length}
                </p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-900 rounded-lg">
                <PiCheckCircle className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Alerts Table */}
        <Card title="Alerts" className="card">
          {alertsLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : filteredAlerts.length > 0 ? (
            <DataTable value={filteredAlerts} className="p-datatable-sm">
              <Column 
                header="Type" 
                body={(rowData) => (
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(rowData.type)}
                    <Badge 
                      value={rowData.type.replace('_', ' ').toUpperCase()} 
                      severity="info"
                    />
                  </div>
                )}
                style={{ width: '120px' }}
              />
              
              <Column 
                field="title" 
                header="Title" 
                body={(rowData) => (
                  <div>
                    <p className={`font-medium ${rowData.isRead ? 'text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                      {rowData.title}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {rowData.message}
                    </p>
                  </div>
                )}
              />
              
              <Column 
                field="severity" 
                header="Severity" 
                body={(rowData) => (
                  <Badge 
                    value={rowData.severity.toUpperCase()} 
                    severity={getSeverityColor(rowData.severity)}
                  />
                )}
                style={{ width: '100px' }}
              />
              
              <Column 
                field="amount" 
                header="Amount" 
                body={(rowData) => rowData.amount ? formatCurrency(rowData.amount, rowData.currency) : '-'}
                style={{ width: '120px' }}
              />
              
              <Column 
                field="createdAt" 
                header="Created" 
                body={(rowData) => formatDate(rowData.createdAt)}
                style={{ width: '140px' }}
              />
              
              <Column 
                header="Status" 
                body={(rowData) => (
                  <div className="flex space-x-1">
                    {!rowData.isRead && (
                      <Badge value="Unread" severity="warning" />
                    )}
                    {rowData.isResolved && (
                      <Badge value="Resolved" severity="success" />
                    )}
                    {rowData.snoozedUntil && new Date(rowData.snoozedUntil) > new Date() && (
                      <Badge value="Snoozed" severity="info" />
                    )}
                  </div>
                )}
                style={{ width: '120px' }}
              />
              
              <Column 
                header="Actions" 
                body={(rowData) => (
                  <div className="flex space-x-1">
                    {!rowData.isRead && (
                      <Button
                        icon={<PiEye className="w-3 h-3" />}
                        size="small"
                        className="p-button-text p-button-sm"
                        tooltip="Mark as Read"
                        onClick={() => handleMarkAsRead(rowData.id)}
                      />
                    )}
                    {!rowData.isResolved && (
                      <Button
                        icon={<PiCheckCircle className="w-3 h-3" />}
                        size="small"
                        className="p-button-text p-button-sm"
                        tooltip="Resolve"
                        onClick={() => handleResolve(rowData.id)}
                      />
                    )}
                    {rowData.transactionId && (
                      <Button
                        icon={<PiTag className="w-3 h-3" />}
                        size="small"
                        className="p-button-text p-button-sm"
                        tooltip="Categorize"
                        onClick={() => {
                          setSelectedAlert(rowData)
                          setShowCategoryDialog(true)
                        }}
                      />
                    )}
                    <Button
                      icon={<PiClock className="w-3 h-3" />}
                      size="small"
                      className="p-button-text p-button-sm"
                      tooltip="Snooze"
                      onClick={() => {
                        setSelectedAlert(rowData)
                        setShowSnoozeDialog(true)
                      }}
                    />
                  </div>
                )}
                style={{ width: '160px' }}
              />
            </DataTable>
          ) : (
            <div className="text-center py-12">
              <PiBell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Alerts Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You're all caught up! No alerts match your current filters.
              </p>
            </div>
          )}
        </Card>

        {/* Snooze Dialog */}
        <Dialog
          visible={showSnoozeDialog}
          onHide={() => setShowSnoozeDialog(false)}
          header="Snooze Alert"
          modal
          className="p-fluid"
          style={{ width: '400px' }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Snooze Duration</label>
              <Dropdown
                value={snoozeHours}
                options={SNOOZE_OPTIONS}
                onChange={(e) => setSnoozeHours(e.value)}
                placeholder="Select duration"
                className="w-full"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This alert will be hidden until {formatDate(new Date(Date.now() + snoozeHours * 60 * 60 * 1000))}
            </p>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowSnoozeDialog(false)}
            />
            <Button
              label="Snooze"
              onClick={handleSnooze}
              loading={snoozeAlertMutation.isLoading}
            />
          </div>
        </Dialog>

        {/* Categorize Dialog */}
        <Dialog
          visible={showCategoryDialog}
          onHide={() => setShowCategoryDialog(false)}
          header="Categorize Transaction"
          modal
          className="p-fluid"
          style={{ width: '400px' }}
        >
          <div className="space-y-4">
            {selectedAlert && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedAlert.merchant}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedAlert.amount ? formatCurrency(selectedAlert.amount, selectedAlert.currency) : ''}
                </p>
              </div>
            )}
            <div>
              <label className="label">Select Category</label>
              <Dropdown
                value={selectedCategory}
                options={categoryOptions}
                onChange={(e) => setSelectedCategory(e.value)}
                placeholder="Choose a category"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowCategoryDialog(false)}
            />
            <Button
              label="Categorize"
              onClick={handleCategorize}
              loading={updateCategoryMutation.isLoading}
              disabled={!selectedCategory}
            />
          </div>
        </Dialog>
      </div>
    </MainLayout>
  )
}
