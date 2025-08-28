// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { InputNumber } from 'primereact/inputnumber'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { Badge } from 'primereact/badge'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Slider } from 'primereact/slider'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiPlus, 
  PiPencil, 
  PiTrash, 
  PiTarget,
  PiTrendingUp,
  PiTrendingDown,
  PiCalendar,
  PiWallet,
  PiCheckCircle,
  PiXCircle,
  PiWarning,
  PiLightbulb
} from 'react-icons/pi'

interface Goal {
  id: string
  name: string
  description: string
  targetAmount: number
  currentAmount: number
  targetDate: Date
  monthlyContribution: number
  accountId: string
  accountName: string
  progressPercent: number
  status: 'on_track' | 'behind' | 'ahead' | 'completed'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface Account {
  id: string
  name: string
  type: string
  balance: number
}

interface GoalSuggestion {
  goalId: string
  suggestedContribution: number
  reason: string
  impact: 'positive' | 'negative' | 'neutral'
}

const GOAL_STATUSES = [
  { label: 'On Track', value: 'on_track' },
  { label: 'Behind', value: 'behind' },
  { label: 'Ahead', value: 'ahead' },
  { label: 'Completed', value: 'completed' },
]

export default function GoalsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useRef<Toast>(null)
  
  // State
  const [showCreateGoal, setShowCreateGoal] = useState(false)
  const [showEditGoal, setShowEditGoal] = useState(false)
  const [showWhatIf, setShowWhatIf] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [whatIfContribution, setWhatIfContribution] = useState(0)
  const [newGoal, setNewGoal] = useState({
    name: '',
    description: '',
    targetAmount: 0,
    targetDate: null as Date | null,
    monthlyContribution: 0,
    accountId: '',
  })

  // Fetch data
  const { data: goals, isLoading: goalsLoading } = useQuery<Goal[]>(
    'goals',
    () => api.get('/goals').then(res => res.data),
    { refetchInterval: 30000 }
  )

  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>(
    'accounts',
    () => api.get('/accounts').then(res => res.data),
    { refetchInterval: 300000 }
  )

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<GoalSuggestion[]>(
    'goal-suggestions',
    () => api.get('/goals/suggestions').then(res => res.data),
    { refetchInterval: 60000 }
  )

  // Mutations
  const createGoalMutation = useMutation(
    (data: any) => api.post('/goals', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('goals')
        queryClient.invalidateQueries('goal-suggestions')
        setShowCreateGoal(false)
        setNewGoal({
          name: '',
          description: '',
          targetAmount: 0,
          targetDate: null,
          monthlyContribution: 0,
          accountId: '',
        })
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Goal created successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to create goal',
        })
      },
    }
  )

  const updateGoalMutation = useMutation(
    (data: { goalId: string; monthlyContribution: number }) =>
      api.put(`/goals/${data.goalId}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('goals')
        queryClient.invalidateQueries('goal-suggestions')
        setShowWhatIf(false)
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Goal updated successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to update goal',
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
      case 'ahead':
        return 'info'
      case 'behind':
        return 'warning'
      case 'completed':
        return 'success'
      default:
        return 'info'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on_track':
        return <PiCheckCircle className="w-4 h-4 text-success-600" />
      case 'ahead':
        return <PiTrendingUp className="w-4 h-4 text-info-600" />
      case 'behind':
        return <PiWarning className="w-4 h-4 text-warning-600" />
      case 'completed':
        return <PiCheckCircle className="w-4 h-4 text-success-600" />
      default:
        return null
    }
  }

  const handleCreateGoal = () => {
    if (!newGoal.name || !newGoal.targetAmount || !newGoal.targetDate || !newGoal.accountId) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please fill in all required fields',
      })
      return
    }

    createGoalMutation.mutate(newGoal)
  }

  const handleWhatIfUpdate = () => {
    if (!selectedGoal) return

    updateGoalMutation.mutate({
      goalId: selectedGoal.id,
      monthlyContribution: whatIfContribution,
    })
  }

  const calculateWhatIfProjection = (goal: Goal, newContribution: number) => {
    const now = new Date()
    const monthsRemaining = Math.max(0, (goal.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
    const projectedAmount = goal.currentAmount + (newContribution * monthsRemaining)
    const projectedProgress = (projectedAmount / goal.targetAmount) * 100
    
    return {
      projectedAmount,
      projectedProgress,
      willReachTarget: projectedAmount >= goal.targetAmount,
      monthsToTarget: projectedAmount >= goal.targetAmount ? 
        Math.ceil((goal.targetAmount - goal.currentAmount) / newContribution) : null,
    }
  }

  const accountOptions = accounts?.map(acc => ({
    label: acc.name,
    value: acc.id,
  })) || []

  const activeGoals = goals?.filter(g => g.isActive) || []
  const completedGoals = goals?.filter(g => g.status === 'completed') || []
  const totalTarget = activeGoals.reduce((sum, goal) => sum + goal.targetAmount, 0)
  const totalSaved = activeGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Goals
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Set and track your financial goals
            </p>
          </div>
          <Button
            label="Create Goal"
            icon={<PiPlus className="w-4 h-4" />}
            onClick={() => setShowCreateGoal(true)}
          />
        </div>

        {/* Overall Progress */}
        <Card className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Goals
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {activeGoals.length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Target
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(totalTarget)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Saved
              </p>
              <p className="text-2xl font-bold text-success-600">
                {formatCurrency(totalSaved)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Overall Progress
              </p>
              <p className="text-2xl font-bold text-primary-600">
                {overallProgress.toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>

        {/* Goal Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <Card title="Smart Suggestions" className="card">
            <div className="space-y-3">
              {suggestions.map((suggestion) => {
                const goal = goals?.find(g => g.id === suggestion.goalId)
                if (!goal) return null

                return (
                  <div key={suggestion.goalId} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <PiLightbulb className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {goal.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {suggestion.reason}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">
                        {formatCurrency(suggestion.suggestedContribution)}/month
                      </p>
                      <Button
                        label="Apply"
                        size="small"
                        className="p-button-outlined p-button-sm"
                        onClick={() => {
                          setSelectedGoal(goal)
                          setWhatIfContribution(suggestion.suggestedContribution)
                          setShowWhatIf(true)
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Active Goals */}
        <Card title="Active Goals" className="card">
          {goalsLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : activeGoals.length > 0 ? (
            <div className="space-y-4">
              {activeGoals.map((goal) => {
                const projection = calculateWhatIfProjection(goal, goal.monthlyContribution)
                
                return (
                  <div key={goal.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {goal.name}
                        </h3>
                        {goal.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {goal.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(goal.status)}
                        <Badge 
                          value={goal.status.replace('_', ' ')} 
                          severity={getStatusColor(goal.status)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="label">Target Amount</label>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(goal.targetAmount)}
                        </p>
                      </div>
                      <div>
                        <label className="label">Current Amount</label>
                        <p className="text-lg font-semibold text-success-600">
                          {formatCurrency(goal.currentAmount)}
                        </p>
                      </div>
                      <div>
                        <label className="label">Monthly Contribution</label>
                        <p className="text-lg font-semibold text-primary-600">
                          {formatCurrency(goal.monthlyContribution)}
                        </p>
                      </div>
                      <div>
                        <label className="label">Target Date</label>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatDate(goal.targetDate)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Progress</span>
                        <span>{goal.progressPercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div 
                          className="h-3 bg-primary-600 rounded-full"
                          style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p>Account: {goal.accountName}</p>
                        {projection.willReachTarget && projection.monthsToTarget && (
                          <p>Will reach target in ~{projection.monthsToTarget} months</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          label="What If"
                          icon={<PiTrendingUp className="w-4 h-4" />}
                          size="small"
                          className="p-button-outlined"
                          onClick={() => {
                            setSelectedGoal(goal)
                            setWhatIfContribution(goal.monthlyContribution)
                            setShowWhatIf(true)
                          }}
                        />
                        <Button
                          icon={<PiPencil className="w-4 h-4" />}
                          size="small"
                          className="p-button-outlined"
                          onClick={() => {
                            setSelectedGoal(goal)
                            setShowEditGoal(true)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <PiTarget className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Active Goals
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first financial goal to start saving
              </p>
              <Button
                label="Create Goal"
                icon={<PiPlus className="w-4 h-4" />}
                onClick={() => setShowCreateGoal(true)}
              />
            </div>
          )}
        </Card>

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <Card title="Completed Goals" className="card">
            <div className="space-y-3">
              {completedGoals.map((goal) => (
                <div key={goal.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {goal.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Completed on {formatDate(goal.updatedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatCurrency(goal.targetAmount)}
                    </p>
                    <Badge value="Completed" severity="success" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Create Goal Dialog */}
        <Dialog
          visible={showCreateGoal}
          onHide={() => setShowCreateGoal(false)}
          header="Create New Goal"
          modal
          className="p-fluid"
          style={{ width: '600px' }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Goal Name</label>
              <input
                type="text"
                value={newGoal.name}
                onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                placeholder="e.g., Emergency Fund"
                className="input"
              />
            </div>

            <div>
              <label className="label">Description (Optional)</label>
              <textarea
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                placeholder="Describe your goal..."
                className="input"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Target Amount</label>
                <InputNumber
                  value={newGoal.targetAmount}
                  onValueChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.value || 0 })}
                  mode="currency"
                  currency="USD"
                  placeholder="0.00"
                  className="w-full"
                />
              </div>

              <div>
                <label className="label">Target Date</label>
                <Calendar
                  value={newGoal.targetDate}
                  onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.value as Date })}
                  showIcon
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Monthly Contribution</label>
                <InputNumber
                  value={newGoal.monthlyContribution}
                  onValueChange={(e) => setNewGoal({ ...newGoal, monthlyContribution: e.value || 0 })}
                  mode="currency"
                  currency="USD"
                  placeholder="0.00"
                  className="w-full"
                />
              </div>

              <div>
                <label className="label">Savings Account</label>
                <Dropdown
                  value={newGoal.accountId}
                  options={accountOptions}
                  onChange={(e) => setNewGoal({ ...newGoal, accountId: e.value })}
                  placeholder="Select account"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowCreateGoal(false)}
            />
            <Button
              label="Create Goal"
              onClick={handleCreateGoal}
              loading={createGoalMutation.isLoading}
              disabled={!newGoal.name || !newGoal.targetAmount || !newGoal.targetDate || !newGoal.accountId}
            />
          </div>
        </Dialog>

        {/* What If Dialog */}
        <Dialog
          visible={showWhatIf}
          onHide={() => setShowWhatIf(false)}
          header="What If Calculator"
          modal
          className="p-fluid"
          style={{ width: '600px' }}
        >
          {selectedGoal && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {selectedGoal.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Adjust your monthly contribution to see how it affects your goal timeline
                </p>
              </div>

              <div>
                <label className="label">Monthly Contribution</label>
                <div className="flex items-center space-x-4">
                  <Slider
                    value={whatIfContribution}
                    onChange={(e) => setWhatIfContribution(e.value as number)}
                    min={0}
                    max={selectedGoal.targetAmount / 12}
                    step={50}
                    className="flex-1"
                  />
                  <InputNumber
                    value={whatIfContribution}
                    onValueChange={(e) => setWhatIfContribution(e.value || 0)}
                    mode="currency"
                    currency="USD"
                    className="w-32"
                  />
                </div>
              </div>

              {(() => {
                const projection = calculateWhatIfProjection(selectedGoal, whatIfContribution)
                return (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                      Projection
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Projected Amount</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(projection.projectedAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Progress</p>
                        <p className="text-lg font-semibold text-primary-600">
                          {projection.projectedProgress.toFixed(1)}%
                        </p>
                      </div>
                      {projection.willReachTarget && projection.monthsToTarget && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Time to Target</p>
                          <p className="text-lg font-semibold text-success-600">
                            ~{projection.monthsToTarget} months
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowWhatIf(false)}
            />
            <Button
              label="Update Goal"
              onClick={handleWhatIfUpdate}
              loading={updateGoalMutation.isLoading}
            />
          </div>
        </Dialog>

        {/* Edit Goal Dialog */}
        <Dialog
          visible={showEditGoal}
          onHide={() => setShowEditGoal(false)}
          header="Edit Goal"
          modal
          className="p-fluid"
          style={{ width: '600px' }}
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Goal editing functionality will be implemented here.
            </p>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowEditGoal(false)}
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
