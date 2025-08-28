// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Badge } from 'primereact/badge'
import { Toast } from 'primereact/toast'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { useRef } from 'react'
import { 
  PiCreditCard, 
  PiPlus, 
  PiArrowsClockwise, 
  PiBank, 
  PiWallet,
  PiCheckCircle,
  PiXCircle,
  PiWarning
} from 'react-icons/pi'

interface Account {
  id: string
  name: string
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'loan'
  balance: number
  currency: string
  isActive: boolean
  connectionId: string
  externalId: string
  createdAt: Date
  updatedAt: Date
  lastSyncAt?: Date
  syncStatus?: 'syncing' | 'success' | 'error' | 'pending'
}

interface Connection {
  id: string
  provider: 'plaid' | 'tink' | 'truelayer'
  status: 'active' | 'error' | 'disconnected'
  institutionName: string
  lastSyncAt?: Date
  errorMessage?: string
}

interface LinkToken {
  linkToken: string
  expiration: Date
}

const ACCOUNT_TYPES = [
  { label: 'Checking', value: 'checking' },
  { label: 'Savings', value: 'savings' },
  { label: 'Credit Card', value: 'credit' },
  { label: 'Investment', value: 'investment' },
  { label: 'Loan', value: 'loan' },
]

const PROVIDERS = [
  { label: 'Plaid', value: 'plaid' },
  { label: 'Tink', value: 'tink' },
  { label: 'TrueLayer', value: 'truelayer' },
]

export default function AccountsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useRef<Toast>(null)
  
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)

  // Fetch accounts data
  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>(
    'accounts',
    () => api.get('/accounts').then(res => res.data),
    { refetchInterval: 30000 } // Refresh every 30 seconds
  )

  const { data: connections, isLoading: connectionsLoading } = useQuery<Connection[]>(
    'connections',
    () => api.get('/connections').then(res => res.data),
    { refetchInterval: 60000 } // Refresh every minute
  )

  // Mutations
  const syncAccountMutation = useMutation(
    (accountId: string) => api.post(`/accounts/${accountId}/sync`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('accounts')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Account synced successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to sync account',
        })
      },
    }
  )

  const createConnectionMutation = useMutation(
    (provider: string) => api.post('/connections', { provider }),
    {
      onSuccess: async (data) => {
        const linkToken = data.data.linkToken
        setIsConnecting(true)
        
        // In a real implementation, you would open the bank's OAuth flow here
        // For now, we'll simulate the process
        setTimeout(() => {
          setIsConnecting(false)
          setShowAddAccount(false)
          queryClient.invalidateQueries('connections')
          queryClient.invalidateQueries('accounts')
          toast.current?.show({
            severity: 'success',
            summary: 'Success',
            detail: 'Account connected successfully',
          })
        }, 2000)
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to create connection',
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

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'checking':
        return <PiCreditCard className="w-5 h-5" />
      case 'savings':
        return <PiBank className="w-5 h-5" />
      case 'credit':
        return <PiCreditCard className="w-5 h-5" />
      case 'investment':
        return <PiWallet className="w-5 h-5" />
      case 'loan':
        return <PiWarning className="w-5 h-5" />
      default:
        return <PiCreditCard className="w-5 h-5" />
    }
  }

  const getAccountTypeLabel = (type: string) => {
    const accountType = ACCOUNT_TYPES.find(t => t.value === type)
    return accountType?.label || type
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'error':
        return 'danger'
      case 'disconnected':
        return 'warning'
      default:
        return 'info'
    }
  }

  const getSyncStatusIcon = (status?: string) => {
    switch (status) {
      case 'syncing':
        return <ProgressSpinner style={{ width: '16px', height: '16px' }} />
      case 'success':
        return <PiCheckCircle className="w-4 h-4 text-success-600" />
      case 'error':
        return <PiXCircle className="w-4 h-4 text-danger-600" />
      default:
        return null
    }
  }

  const handleSyncAccount = (accountId: string) => {
    syncAccountMutation.mutate(accountId)
  }

  const handleAddAccount = () => {
    if (!selectedProvider) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please select a provider',
      })
      return
    }
    createConnectionMutation.mutate(selectedProvider)
  }

  const totalBalance = accounts?.reduce((sum, account) => sum + account.balance, 0) || 0
  const activeAccounts = accounts?.filter(account => account.isActive) || []
  const inactiveAccounts = accounts?.filter(account => !account.isActive) || []

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Accounts
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your bank accounts and connections
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              label="Add Account"
              icon={<PiPlus className="w-4 h-4" />}
              onClick={() => setShowAddAccount(true)}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Balance
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(totalBalance)}
                </p>
              </div>
              <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <PiWallet className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Active Accounts
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {activeAccounts.length}
                </p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-900 rounded-lg">
                <PiCheckCircle className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Connections
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {connections?.length || 0}
                </p>
              </div>
              <div className="p-3 bg-info-100 dark:bg-info-900 rounded-lg">
                <PiBank className="w-6 h-6 text-info-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Active Accounts */}
        <Card title="Active Accounts" className="card">
          {accountsLoading ? (
            <div className="flex items-center justify-center h-32">
              <ProgressSpinner />
            </div>
          ) : activeAccounts.length > 0 ? (
            <DataTable value={activeAccounts} className="p-datatable-sm">
              <Column 
                field="name" 
                header="Account Name" 
                body={(rowData) => (
                  <div className="flex items-center space-x-3">
                    {getAccountTypeIcon(rowData.type)}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {rowData.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {getAccountTypeLabel(rowData.type)}
                      </p>
                    </div>
                  </div>
                )}
              />
              <Column 
                field="balance" 
                header="Balance" 
                body={(rowData) => (
                  <span className={`font-bold ${
                    rowData.balance >= 0 ? 'text-success-600' : 'text-danger-600'
                  }`}>
                    {formatCurrency(rowData.balance, rowData.currency)}
                  </span>
                )}
              />
              <Column 
                field="lastSyncAt" 
                header="Last Sync" 
                body={(rowData) => rowData.lastSyncAt ? formatDate(rowData.lastSyncAt) : 'Never'}
              />
              <Column 
                field="syncStatus" 
                header="Status" 
                body={(rowData) => (
                  <div className="flex items-center space-x-2">
                    {getSyncStatusIcon(rowData.syncStatus)}
                    <Badge 
                      value={rowData.syncStatus || 'unknown'} 
                      severity={rowData.syncStatus === 'error' ? 'danger' : 'success'}
                    />
                  </div>
                )}
              />
              <Column 
                header="Actions" 
                body={(rowData) => (
                  <div className="flex space-x-2">
                    <Button
                      icon={<PiArrowsClockwise className="w-4 h-4" />}
                      size="small"
                      className="p-button-outlined p-button-sm"
                      loading={syncAccountMutation.isLoading}
                      onClick={() => handleSyncAccount(rowData.id)}
                      tooltip="Sync Account"
                    />
                  </div>
                )}
              />
            </DataTable>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No active accounts found
            </div>
          )}
        </Card>

        {/* Connections */}
        <Card title="Bank Connections" className="card">
          {connectionsLoading ? (
            <div className="flex items-center justify-center h-32">
              <ProgressSpinner />
            </div>
          ) : connections && connections.length > 0 ? (
            <DataTable value={connections} className="p-datatable-sm">
              <Column field="institutionName" header="Institution" />
              <Column 
                field="provider" 
                header="Provider" 
                body={(rowData) => (
                  <Badge value={rowData.provider.toUpperCase()} severity="info" />
                )}
              />
              <Column 
                field="status" 
                header="Status" 
                body={(rowData) => (
                  <Badge 
                    value={rowData.status} 
                    severity={getStatusColor(rowData.status)}
                  />
                )}
              />
              <Column 
                field="lastSyncAt" 
                header="Last Sync" 
                body={(rowData) => rowData.lastSyncAt ? formatDate(rowData.lastSyncAt) : 'Never'}
              />
              <Column 
                field="errorMessage" 
                header="Error" 
                body={(rowData) => rowData.errorMessage || '-'}
              />
            </DataTable>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No bank connections found
            </div>
          )}
        </Card>

        {/* Inactive Accounts */}
        {inactiveAccounts.length > 0 && (
          <Card title="Inactive Accounts" className="card">
            <DataTable value={inactiveAccounts} className="p-datatable-sm">
              <Column 
                field="name" 
                header="Account Name" 
                body={(rowData) => (
                  <div className="flex items-center space-x-3">
                    {getAccountTypeIcon(rowData.type)}
                    <div>
                      <p className="font-medium text-gray-500">
                        {rowData.name}
                      </p>
                      <p className="text-sm text-gray-400">
                        {getAccountTypeLabel(rowData.type)}
                      </p>
                    </div>
                  </div>
                )}
              />
              <Column 
                field="balance" 
                header="Balance" 
                body={(rowData) => formatCurrency(rowData.balance, rowData.currency)}
              />
              <Column 
                field="updatedAt" 
                header="Last Updated" 
                body={(rowData) => formatDate(rowData.updatedAt)}
              />
            </DataTable>
          </Card>
        )}

        {/* Add Account Dialog */}
        <Dialog
          visible={showAddAccount}
          onHide={() => setShowAddAccount(false)}
          header="Add Bank Account"
          modal
          className="p-fluid"
          style={{ width: '500px' }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Select Provider</label>
              <Dropdown
                value={selectedProvider}
                options={PROVIDERS}
                onChange={(e) => setSelectedProvider(e.value)}
                placeholder="Choose a provider"
                className="w-full"
              />
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>Supported providers:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Plaid:</strong> Connect to thousands of banks in the US and Canada</li>
                <li><strong>Tink:</strong> European bank connectivity</li>
                <li><strong>TrueLayer:</strong> UK and European bank connectivity</li>
              </ul>
            </div>

            {isConnecting && (
              <div className="flex items-center justify-center space-x-2 text-primary-600">
                <ProgressSpinner style={{ width: '20px', height: '20px' }} />
                <span>Connecting to your bank...</span>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowAddAccount(false)}
              disabled={isConnecting}
            />
            <Button
              label="Connect"
              onClick={handleAddAccount}
              loading={isConnecting}
              disabled={!selectedProvider || isConnecting}
            />
          </div>
        </Dialog>
      </div>
    </MainLayout>
  )
}
