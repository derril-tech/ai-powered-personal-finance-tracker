// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { Badge } from 'primereact/badge'
import { ProgressSpinner } from 'primereact/progressspinner'
import { ToggleButton } from 'primereact/togglebutton'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiPlus, 
  PiPencil, 
  PiTrash, 
  PiWallet,
  PiChartPie,
  PiArrowsClockwise,
  PiTarget,
  PiWarning,
  PiCheckCircle,
  PiXCircle,
  PiDotsThreeVertical
} from 'react-icons/pi'

interface Budget {
  id: string
  name: string
  period: 'monthly' | 'quarterly' | 'yearly'
  startDate: Date
  endDate: Date
  totalBudget: number
  totalSpent: number
  remaining: number
  utilizationPercent: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface BudgetLine {
  id: string
  categoryId: string
  categoryName: string
  categoryColor: string
  budget: number
  spent: number
  remaining: number
  utilizationPercent: number
  rollover: boolean
  status: 'on_track' | 'warning' | 'over_budget'
}

interface Category {
  id: string
  name: string
  color: string
  parentId?: string
}

interface SafeToSpend {
  total: number
  breakdown: {
    category: string
    amount: number
    percent: number
  }[]
}

const BUDGET_PERIODS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
]

export default function BudgetsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useRef<Toast>(null)
  
  // State
  const [showCreateBudget, setShowCreateBudget] = useState(false)
  const [showEditBudget, setShowEditBudget] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null)
  const [viewMode, setViewMode] = useState<'envelope' | 'zero-based'>('envelope')
  const [newBudget, setNewBudget] = useState({
    name: '',
    period: 'monthly',
    totalBudget: 0,
  })

  // Fetch data
  const { data: budgets, isLoading: budgetsLoading } = useQuery<Budget[]>(
    'budgets',
    () => api.get('/budgets').then(res => res.data),
    { refetchInterval: 30000 }
  )

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>(
    'categories',
    () => api.get('/categories').then(res => res.data),
    { refetchInterval: 300000 }
  )

  const { data: safeToSpend, isLoading: safeToSpendLoading } = useQuery<SafeToSpend>(
    'safe-to-spend',
    () => api.get('/budgets/safe-to-spend').then(res => res.data),
    { refetchInterval: 60000 }
  )

  // Mutations
  const createBudgetMutation = useMutation(
    (data: any) => api.post('/budgets', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('budgets')
        setShowCreateBudget(false)
        setNewBudget({ name: '', period: 'monthly', totalBudget: 0 })
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Budget created successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to create budget',
        })
      },
    }
  )

  const updateBudgetLineMutation = useMutation(
    (data: { budgetLineId: string; budget: number; rollover: boolean }) =>
      api.put(`/budgets/lines/${data.budgetLineId}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('budgets')
        queryClient.invalidateQueries('safe-to-spend')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Budget line updated successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to update budget line',
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track':
        return 'success'
      case 'warning':
        return 'warning'
      case 'over_budget':
        return 'danger'
      default:
        return 'info'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on_track':
        return <PiCheckCircle className="w-4 h-4 text-success-600" />
      case 'warning':
        return <PiWarning className="w-4 h-4 text-warning-600" />
      case 'over_budget':
        return <PiXCircle className="w-4 h-4 text-danger-600" />
      default:
        return null
    }
  }

  const handleCreateBudget = () => {
    if (!newBudget.name || newBudget.totalBudget <= 0) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please fill in all required fields',
      })
      return
    }

    createBudgetMutation.mutate(newBudget)
  }

  const handleBudgetLineUpdate = (budgetLineId: string, budget: number, rollover: boolean) => {
    updateBudgetLineMutation.mutate({ budgetLineId, budget, rollover })
  }

  const activeBudget = budgets?.find(b => b.isActive)
  const totalBudget = activeBudget?.totalBudget || 0
  const totalSpent = activeBudget?.totalSpent || 0
  const remaining = activeBudget?.remaining || 0
  const utilizationPercent = activeBudget?.utilizationPercent || 0

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Budgets
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your spending with envelope budgeting
            </p>
          </div>
          <div className="flex space-x-2">
            <ToggleButton
              onLabel="Envelope"
              offLabel="Zero-Based"
              onIcon={<PiWallet className="w-4 h-4" />}
              offIcon={<PiChartPie className="w-4 h-4" />}
              checked={viewMode === 'envelope'}
              onChange={(e) => setViewMode(e.checked ? 'envelope' : 'zero-based')}
              className="p-button-outlined"
            />
            <Button
              label="Create Budget"
              icon={<PiPlus className="w-4 h-4" />}
              onClick={() => setShowCreateBudget(true)}
            />
          </div>
        </div>

        {/* Safe to Spend Indicator */}
        <Card className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Safe to Spend
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Available funds across all categories
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-success-600">
                {safeToSpendLoading ? (
                  <ProgressSpinner style={{ width: '32px', height: '32px' }} />
                ) : (
                  formatCurrency(safeToSpend?.total || 0)
                )}
              </p>
              <p className="text-sm text-gray-500">
                {activeBudget ? `${formatCurrency(remaining)} remaining` : 'No active budget'}
              </p>
            </div>
          </div>
        </Card>

        {/* Budget Overview */}
        {activeBudget && (
          <Card className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {activeBudget.name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {formatDate(activeBudget.startDate)} - {formatDate(activeBudget.endDate)}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge 
                  value={activeBudget.period.toUpperCase()} 
                  severity="info" 
                />
                <Button
                  icon={<PiPencil className="w-4 h-4" />}
                  size="small"
                  className="p-button-outlined"
                  onClick={() => {
                    setSelectedBudget(activeBudget)
                    setShowEditBudget(true)
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Budget
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(totalBudget)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Spent
                </p>
                <p className="text-2xl font-bold text-danger-600">
                  {formatCurrency(totalSpent)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Remaining
                </p>
                <p className="text-2xl font-bold text-success-600">
                  {formatCurrency(remaining)}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Budget Utilization</span>
                <span>{utilizationPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    utilizationPercent >= 100 ? 'bg-danger-600' :
                    utilizationPercent >= 80 ? 'bg-warning-600' : 'bg-success-600'
                  }`}
                  style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Budget Lines */}
        {activeBudget && (
          <Card title="Budget Categories" className="card">
            {budgetsLoading ? (
              <div className="flex items-center justify-center h-64">
                <ProgressSpinner />
              </div>
            ) : (
              <div className="space-y-4">
                {categories?.map((category) => {
                  // Mock budget line data - in real implementation, this would come from the API
                  const mockBudgetLine: BudgetLine = {
                    id: `line-${category.id}`,
                    categoryId: category.id,
                    categoryName: category.name,
                    categoryColor: category.color,
                    budget: 500, // Mock data
                    spent: 350, // Mock data
                    remaining: 150, // Mock data
                    utilizationPercent: 70, // Mock data
                    rollover: false,
                    status: 'on_track',
                  }

                  return (
                    <div key={category.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {category.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(mockBudgetLine.spent)} of {formatCurrency(mockBudgetLine.budget)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(mockBudgetLine.status)}
                          <Badge 
                            value={mockBudgetLine.status.replace('_', ' ')} 
                            severity={getStatusColor(mockBudgetLine.status)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="label">Budget</label>
                          <InputNumber
                            value={mockBudgetLine.budget}
                            onValueChange={(e) => handleBudgetLineUpdate(
                              mockBudgetLine.id, 
                              e.value || 0, 
                              mockBudgetLine.rollover
                            )}
                            mode="currency"
                            currency="USD"
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="label">Spent</label>
                          <p className="text-lg font-semibold text-danger-600">
                            {formatCurrency(mockBudgetLine.spent)}
                          </p>
                        </div>
                        <div>
                          <label className="label">Remaining</label>
                          <p className="text-lg font-semibold text-success-600">
                            {formatCurrency(mockBudgetLine.remaining)}
                          </p>
                        </div>
                        <div>
                          <label className="label">Rollover</label>
                          <ToggleButton
                            checked={mockBudgetLine.rollover}
                            onChange={(e) => handleBudgetLineUpdate(
                              mockBudgetLine.id, 
                              mockBudgetLine.budget, 
                              e.checked
                            )}
                            onLabel="Yes"
                            offLabel="No"
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <span>Progress</span>
                          <span>{mockBudgetLine.utilizationPercent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              mockBudgetLine.utilizationPercent >= 100 ? 'bg-danger-600' :
                              mockBudgetLine.utilizationPercent >= 80 ? 'bg-warning-600' : 'bg-success-600'
                            }`}
                            style={{ width: `${Math.min(mockBudgetLine.utilizationPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* No Active Budget */}
        {!activeBudget && !budgetsLoading && (
          <Card className="card">
            <div className="text-center py-12">
              <PiWallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Active Budget
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first budget to start tracking your spending
              </p>
              <Button
                label="Create Budget"
                icon={<PiPlus className="w-4 h-4" />}
                onClick={() => setShowCreateBudget(true)}
              />
            </div>
          </Card>
        )}

        {/* Create Budget Dialog */}
        <Dialog
          visible={showCreateBudget}
          onHide={() => setShowCreateBudget(false)}
          header="Create New Budget"
          modal
          className="p-fluid"
          style={{ width: '500px' }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Budget Name</label>
              <input
                type="text"
                value={newBudget.name}
                onChange={(e) => setNewBudget({ ...newBudget, name: e.target.value })}
                placeholder="e.g., December 2024 Budget"
                className="input"
              />
            </div>

            <div>
              <label className="label">Period</label>
              <Dropdown
                value={newBudget.period}
                options={BUDGET_PERIODS}
                onChange={(e) => setNewBudget({ ...newBudget, period: e.value })}
                placeholder="Select period"
                className="w-full"
              />
            </div>

            <div>
              <label className="label">Total Budget</label>
              <InputNumber
                value={newBudget.totalBudget}
                onValueChange={(e) => setNewBudget({ ...newBudget, totalBudget: e.value || 0 })}
                mode="currency"
                currency="USD"
                placeholder="0.00"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowCreateBudget(false)}
            />
            <Button
              label="Create Budget"
              onClick={handleCreateBudget}
              loading={createBudgetMutation.isLoading}
              disabled={!newBudget.name || newBudget.totalBudget <= 0}
            />
          </div>
        </Dialog>

        {/* Edit Budget Dialog */}
        <Dialog
          visible={showEditBudget}
          onHide={() => setShowEditBudget(false)}
          header="Edit Budget"
          modal
          className="p-fluid"
          style={{ width: '500px' }}
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Budget editing functionality will be implemented here.
            </p>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowEditBudget(false)}
            />
            <Button
              label="Save Changes"
              disabled
            />
          </div>
        </Dialog>
      </div>
    </MainLayout>
  )
}
