// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Calendar } from 'primereact/calendar'
import { Dialog } from 'primereact/dialog'
import { MultiSelect } from 'primereact/multiselect'
import { Toast } from 'primereact/toast'
import { Badge } from 'primereact/badge'
import { ProgressSpinner } from 'primereact/progressspinner'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiMagnifyingGlass, 
  PiFunnel, 
  PiPlus, 
  PiPencil, 
  PiTrash, 
  PiTag,
  PiSplit,
  PiRule,
  PiDownload,
  PiUpload,
  PiCheckCircle,
  PiXCircle,
  PiWarning
} from 'react-icons/pi'

interface Transaction {
  id: string
  merchant: string
  amount: number
  currency: string
  date: Date
  categoryId: string
  categoryName: string
  categoryColor: string
  accountId: string
  accountName: string
  description: string
  isTransfer: boolean
  confidenceScore: number
  isSplit: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

interface Category {
  id: string
  name: string
  color: string
  parentId?: string
}

interface Account {
  id: string
  name: string
  type: string
}

interface TransactionsListResponse {
  data: Transaction[]
  pagination: {
    cursor: string
    hasMore: boolean
    total: number
  }
}

const TRANSACTION_TYPES = [
  { label: 'All', value: 'all' },
  { label: 'Expenses', value: 'expenses' },
  { label: 'Income', value: 'income' },
  { label: 'Transfers', value: 'transfers' },
]

const CONFIDENCE_LEVELS = [
  { label: 'All', value: 'all' },
  { label: 'High (90%+)', value: 'high' },
  { label: 'Medium (70-89%)', value: 'medium' },
  { label: 'Low (<70%)', value: 'low' },
]

export default function TransactionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useRef<Toast>(null)
  
  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedConfidence, setSelectedConfidence] = useState('all')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null])
  const [selectedTransactions, setSelectedTransactions] = useState<Transaction[]>([])
  const [showSplitDialog, setShowSplitDialog] = useState(false)
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [showBulkCategorize, setShowBulkCategorize] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [bulkCategory, setBulkCategory] = useState<string>('')

  // Fetch data
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery<TransactionsListResponse>(
    ['transactions', searchTerm, selectedType, selectedConfidence, selectedCategories, selectedAccounts, dateRange, cursor],
    () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedType !== 'all') params.append('type', selectedType)
      if (selectedConfidence !== 'all') params.append('confidence', selectedConfidence)
      if (selectedCategories.length > 0) params.append('categories', selectedCategories.join(','))
      if (selectedAccounts.length > 0) params.append('accounts', selectedAccounts.join(','))
      if (dateRange[0]) params.append('startDate', dateRange[0].toISOString())
      if (dateRange[1]) params.append('endDate', dateRange[1].toISOString())
      if (cursor) params.append('cursor', cursor)
      params.append('limit', '50')
      
      return api.get(`/transactions?${params.toString()}`).then(res => res.data)
    },
    { refetchInterval: 30000 }
  )

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>(
    'categories',
    () => api.get('/categories').then(res => res.data),
    { refetchInterval: 300000 }
  )

  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>(
    'accounts',
    () => api.get('/accounts').then(res => res.data),
    { refetchInterval: 300000 }
  )

  // Mutations
  const bulkCategorizeMutation = useMutation(
    (data: { transactionIds: string[], categoryId: string }) =>
      api.post('/transactions/bulk-categorize', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('transactions')
        setSelectedTransactions([])
        setShowBulkCategorize(false)
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Transactions categorized successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to categorize transactions',
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
    return format(new Date(date), 'MMM dd, yyyy')
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'success'
    if (score >= 0.7) return 'warning'
    return 'danger'
  }

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.9) return 'High'
    if (score >= 0.7) return 'Medium'
    return 'Low'
  }

  const handleBulkCategorize = () => {
    if (!bulkCategory || selectedTransactions.length === 0) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please select a category and transactions',
      })
      return
    }

    bulkCategorizeMutation.mutate({
      transactionIds: selectedTransactions.map(t => t.id),
      categoryId: bulkCategory,
    })
  }

  const handleLoadMore = () => {
    if (transactionsData?.pagination.hasMore) {
      setCursor(transactionsData.pagination.cursor)
    }
  }

  const categoryOptions = categories?.map(cat => ({
    label: cat.name,
    value: cat.id,
  })) || []

  const accountOptions = accounts?.map(acc => ({
    label: acc.name,
    value: acc.id,
  })) || []

  const filteredTransactions = transactionsData?.data || []

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Transactions
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage and analyze your financial transactions
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              label="Import"
              icon={<PiUpload className="w-4 h-4" />}
              className="p-button-outlined"
            />
            <Button
              label="Export"
              icon={<PiDownload className="w-4 h-4" />}
              className="p-button-outlined"
            />
            <Button
              label="Add Transaction"
              icon={<PiPlus className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Filters */}
        <Card className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <PiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <InputText
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search transactions..."
                className="pl-10 w-full"
              />
            </div>

            {/* Transaction Type */}
            <Dropdown
              value={selectedType}
              options={TRANSACTION_TYPES}
              onChange={(e) => setSelectedType(e.value)}
              placeholder="Transaction Type"
              className="w-full"
            />

            {/* Confidence Level */}
            <Dropdown
              value={selectedConfidence}
              options={CONFIDENCE_LEVELS}
              onChange={(e) => setSelectedConfidence(e.value)}
              placeholder="Confidence Level"
              className="w-full"
            />

            {/* Date Range */}
            <Calendar
              value={dateRange}
              onChange={(e) => setDateRange(e.value as [Date | null, Date | null])}
              selectionMode="range"
              placeholder="Date Range"
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Categories */}
            <MultiSelect
              value={selectedCategories}
              options={categoryOptions}
              onChange={(e) => setSelectedCategories(e.value)}
              placeholder="Filter by Categories"
              className="w-full"
            />

            {/* Accounts */}
            <MultiSelect
              value={selectedAccounts}
              options={accountOptions}
              onChange={(e) => setSelectedAccounts(e.value)}
              placeholder="Filter by Accounts"
              className="w-full"
            />
          </div>
        </Card>

        {/* Bulk Actions */}
        {selectedTransactions.length > 0 && (
          <Card className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedTransactions.length} transaction(s) selected
                </span>
                <Button
                  label="Bulk Categorize"
                  icon={<PiTag className="w-4 h-4" />}
                  size="small"
                  onClick={() => setShowBulkCategorize(true)}
                />
                <Button
                  label="Create Rule"
                  icon={<PiRule className="w-4 h-4" />}
                  size="small"
                  className="p-button-outlined"
                  onClick={() => setShowRuleDialog(true)}
                />
              </div>
              <Button
                label="Clear Selection"
                size="small"
                className="p-button-text"
                onClick={() => setSelectedTransactions([])}
              />
            </div>
          </Card>
        )}

        {/* Transactions Table */}
        <Card className="card">
          {transactionsLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : (
            <>
              <DataTable
                value={filteredTransactions}
                selection={selectedTransactions}
                onSelectionChange={(e) => setSelectedTransactions(e.value)}
                dataKey="id"
                paginator={false}
                rows={50}
                virtualScrollerOptions={{ itemSize: 60 }}
                className="p-datatable-sm"
                emptyMessage="No transactions found"
              >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
                
                <Column 
                  field="date" 
                  header="Date" 
                  body={(rowData) => formatDate(rowData.date)}
                  sortable
                  style={{ width: '100px' }}
                />
                
                <Column 
                  field="merchant" 
                  header="Merchant" 
                  body={(rowData) => (
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {rowData.merchant}
                      </p>
                      {rowData.description && (
                        <p className="text-sm text-gray-500">{rowData.description}</p>
                      )}
                    </div>
                  )}
                  sortable
                />
                
                <Column 
                  field="amount" 
                  header="Amount" 
                  body={(rowData) => (
                    <span className={`font-bold ${
                      rowData.amount >= 0 ? 'text-success-600' : 'text-danger-600'
                    }`}>
                      {formatCurrency(rowData.amount, rowData.currency)}
                    </span>
                  )}
                  sortable
                  style={{ width: '120px' }}
                />
                
                <Column 
                  field="categoryName" 
                  header="Category" 
                  body={(rowData) => (
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: rowData.categoryColor }}
                      />
                      <span>{rowData.categoryName}</span>
                    </div>
                  )}
                  sortable
                />
                
                <Column 
                  field="accountName" 
                  header="Account" 
                  body={(rowData) => rowData.accountName}
                  sortable
                />
                
                <Column 
                  field="confidenceScore" 
                  header="Confidence" 
                  body={(rowData) => (
                    <Badge 
                      value={`${getConfidenceLabel(rowData.confidenceScore)} (${(rowData.confidenceScore * 100).toFixed(0)}%)`}
                      severity={getConfidenceColor(rowData.confidenceScore)}
                    />
                  )}
                  sortable
                  style={{ width: '120px' }}
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
                        icon={<PiSplit className="w-3 h-3" />}
                        size="small"
                        className="p-button-text p-button-sm"
                        tooltip="Split"
                        onClick={() => setShowSplitDialog(true)}
                      />
                      <Button
                        icon={<PiRule className="w-3 h-3" />}
                        size="small"
                        className="p-button-text p-button-sm"
                        tooltip="Create Rule"
                      />
                    </div>
                  )}
                  style={{ width: '120px' }}
                />
              </DataTable>

              {/* Load More */}
              {transactionsData?.pagination.hasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    label="Load More"
                    onClick={handleLoadMore}
                    className="p-button-outlined"
                  />
                </div>
              )}
            </>
          )}
        </Card>

        {/* Bulk Categorize Dialog */}
        <Dialog
          visible={showBulkCategorize}
          onHide={() => setShowBulkCategorize(false)}
          header="Bulk Categorize Transactions"
          modal
          className="p-fluid"
          style={{ width: '500px' }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Select Category</label>
              <Dropdown
                value={bulkCategory}
                options={categoryOptions}
                onChange={(e) => setBulkCategory(e.value)}
                placeholder="Choose a category"
                className="w-full"
              />
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>This will categorize {selectedTransactions.length} transaction(s):</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {selectedTransactions.slice(0, 5).map((transaction) => (
                  <li key={transaction.id}>
                    {transaction.merchant} - {formatCurrency(transaction.amount, transaction.currency)}
                  </li>
                ))}
                {selectedTransactions.length > 5 && (
                  <li>... and {selectedTransactions.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowBulkCategorize(false)}
            />
            <Button
              label="Categorize"
              onClick={handleBulkCategorize}
              loading={bulkCategorizeMutation.isLoading}
              disabled={!bulkCategory}
            />
          </div>
        </Dialog>

        {/* Split Transaction Dialog */}
        <Dialog
          visible={showSplitDialog}
          onHide={() => setShowSplitDialog(false)}
          header="Split Transaction"
          modal
          className="p-fluid"
          style={{ width: '600px' }}
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Split transaction functionality will be implemented here.
            </p>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowSplitDialog(false)}
            />
            <Button
              label="Split"
              disabled
            />
          </div>
        </Dialog>

        {/* Create Rule Dialog */}
        <Dialog
          visible={showRuleDialog}
          onHide={() => setShowRuleDialog(false)}
          header="Create Rule from Selection"
          modal
          className="p-fluid"
          style={{ width: '600px' }}
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Rule creation functionality will be implemented here.
            </p>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowRuleDialog(false)}
            />
            <Button
              label="Create Rule"
              disabled
            />
          </div>
        </Dialog>
      </div>
    </MainLayout>
  )
}
