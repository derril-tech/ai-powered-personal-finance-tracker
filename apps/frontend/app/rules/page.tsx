// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Dropdown } from 'primereact/dropdown'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { ProgressSpinner } from 'primereact/progressspinner'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Badge } from 'primereact/badge'
import { Switch } from 'primereact/switch'
import { InputNumber } from 'primereact/inputnumber'
import { Calendar } from 'primereact/calendar'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiPlus, 
  PiTrash, 
  PiEye, 
  PiPlay, 
  PiPause,
  PiGear,
  PiFunnel,
  PiCheck,
  PiX,
  PiArrowRight,
  PiArrowDown,
  PiTag,
  PiBell,
  PiFileText,
  PiExclude,
  PiSplit,
  PiCalculator,
  PiCalendar,
  PiMapPin,
  PiGlobe,
  PiClock,
  PiDollarSign,
  PiBuilding
} from 'react-icons/pi'

interface Rule {
  id: string
  name: string
  description?: string
  isActive: boolean
  priority: number
  conditions: RuleCondition[]
  actions: RuleAction[]
  affectedTransactions: number
  lastRunAt?: Date
  createdAt: Date
  updatedAt: Date
}

interface RuleCondition {
  id: string
  field: 'merchant' | 'amount' | 'category' | 'account' | 'date' | 'description' | 'country'
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in'
  value: any
  value2?: any // For between operations
}

interface RuleAction {
  id: string
  type: 'set_category' | 'add_tag' | 'add_note' | 'exclude' | 'split' | 'create_alert'
  value: any
  metadata?: any
}

interface Category {
  id: string
  name: string
  color: string
}

interface Account {
  id: string
  name: string
  type: string
  institutionName: string
}

interface Transaction {
  id: string
  merchant: string
  amount: number
  currency: string
  categoryName?: string
  accountName: string
  date: Date
  description: string
  isExcluded: boolean
}

const CONDITION_FIELDS = [
  { label: 'Merchant', value: 'merchant', icon: <PiBuilding className="w-4 h-4" /> },
  { label: 'Amount', value: 'amount', icon: <PiDollarSign className="w-4 h-4" /> },
  { label: 'Category', value: 'category', icon: <PiTag className="w-4 h-4" /> },
  { label: 'Account', value: 'account', icon: <PiGear className="w-4 h-4" /> },
  { label: 'Date', value: 'date', icon: <PiCalendar className="w-4 h-4" /> },
  { label: 'Description', value: 'description', icon: <PiFileText className="w-4 h-4" /> },
  { label: 'Country', value: 'country', icon: <PiGlobe className="w-4 h-4" /> },
]

const CONDITION_OPERATORS = {
  merchant: [
    { label: 'Contains', value: 'contains' },
    { label: 'Equals', value: 'equals' },
    { label: 'Starts with', value: 'starts_with' },
    { label: 'Ends with', value: 'ends_with' },
    { label: 'Regex', value: 'regex' },
  ],
  amount: [
    { label: 'Equals', value: 'equals' },
    { label: 'Greater than', value: 'greater_than' },
    { label: 'Less than', value: 'less_than' },
    { label: 'Between', value: 'between' },
  ],
  category: [
    { label: 'Equals', value: 'equals' },
    { label: 'In', value: 'in' },
    { label: 'Not in', value: 'not_in' },
  ],
  account: [
    { label: 'Equals', value: 'equals' },
    { label: 'In', value: 'in' },
    { label: 'Not in', value: 'not_in' },
  ],
  date: [
    { label: 'Equals', value: 'equals' },
    { label: 'Greater than', value: 'greater_than' },
    { label: 'Less than', value: 'less_than' },
    { label: 'Between', value: 'between' },
  ],
  description: [
    { label: 'Contains', value: 'contains' },
    { label: 'Equals', value: 'equals' },
    { label: 'Starts with', value: 'starts_with' },
    { label: 'Ends with', value: 'ends_with' },
    { label: 'Regex', value: 'regex' },
  ],
  country: [
    { label: 'Equals', value: 'equals' },
    { label: 'In', value: 'in' },
    { label: 'Not in', value: 'not_in' },
  ],
}

const ACTION_TYPES = [
  { label: 'Set Category', value: 'set_category', icon: <PiTag className="w-4 h-4" /> },
  { label: 'Add Tag', value: 'add_tag', icon: <PiTag className="w-4 h-4" /> },
  { label: 'Add Note', value: 'add_note', icon: <PiFileText className="w-4 h-4" /> },
  { label: 'Exclude', value: 'exclude', icon: <PiExclude className="w-4 h-4" /> },
  { label: 'Split', value: 'split', icon: <PiSplit className="w-4 h-4" /> },
  { label: 'Create Alert', value: 'create_alert', icon: <PiBell className="w-4 h-4" /> },
]

export default function RulesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useRef<Toast>(null)
  
  // State
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null)
  const [ruleName, setRuleName] = useState('')
  const [ruleDescription, setRuleDescription] = useState('')
  const [rulePriority, setRulePriority] = useState(1)
  const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([])
  const [ruleActions, setRuleActions] = useState<RuleAction[]>([])
  const [previewTransactions, setPreviewTransactions] = useState<Transaction[]>([])

  // Fetch data
  const { data: rules, isLoading: rulesLoading } = useQuery<Rule[]>(
    'rules',
    () => api.get('/rules').then(res => res.data),
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
  const createRuleMutation = useMutation(
    (data: Partial<Rule>) => api.post('/rules', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('rules')
        setShowCreateDialog(false)
        resetForm()
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Rule created successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to create rule',
        })
      },
    }
  )

  const updateRuleMutation = useMutation(
    (data: { id: string; updates: Partial<Rule> }) => api.put(`/rules/${data.id}`, data.updates),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('rules')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Rule updated successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to update rule',
        })
      },
    }
  )

  const deleteRuleMutation = useMutation(
    (ruleId: string) => api.delete(`/rules/${ruleId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('rules')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Rule deleted successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to delete rule',
        })
      },
    }
  )

  const previewRuleMutation = useMutation(
    (data: { conditions: RuleCondition[]; actions: RuleAction[] }) => 
      api.post('/rules/preview', data),
    {
      onSuccess: (data) => {
        setPreviewTransactions(data.data.transactions)
        setShowPreviewDialog(true)
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to preview rule',
        })
      },
    }
  )

  const runRuleRetroactivelyMutation = useMutation(
    (ruleId: string) => api.post(`/rules/${ruleId}/run`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('rules')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Rule applied retroactively',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to run rule',
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

  const resetForm = () => {
    setRuleName('')
    setRuleDescription('')
    setRulePriority(1)
    setRuleConditions([])
    setRuleActions([])
  }

  const addCondition = () => {
    const newCondition: RuleCondition = {
      id: Date.now().toString(),
      field: 'merchant',
      operator: 'contains',
      value: '',
    }
    setRuleConditions([...ruleConditions, newCondition])
  }

  const removeCondition = (conditionId: string) => {
    setRuleConditions(ruleConditions.filter(c => c.id !== conditionId))
  }

  const updateCondition = (conditionId: string, field: keyof RuleCondition, value: any) => {
    setRuleConditions(ruleConditions.map(c => 
      c.id === conditionId ? { ...c, [field]: value } : c
    ))
  }

  const addAction = () => {
    const newAction: RuleAction = {
      id: Date.now().toString(),
      type: 'set_category',
      value: '',
    }
    setRuleActions([...ruleActions, newAction])
  }

  const removeAction = (actionId: string) => {
    setRuleActions(ruleActions.filter(a => a.id !== actionId))
  }

  const updateAction = (actionId: string, field: keyof RuleAction, value: any) => {
    setRuleActions(ruleActions.map(a => 
      a.id === actionId ? { ...a, [field]: value } : a
    ))
  }

  const handleCreateRule = () => {
    if (!ruleName.trim() || ruleConditions.length === 0 || ruleActions.length === 0) {
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Please fill in all required fields',
      })
      return
    }

    createRuleMutation.mutate({
      name: ruleName,
      description: ruleDescription,
      priority: rulePriority,
      conditions: ruleConditions,
      actions: ruleActions,
      isActive: true,
    })
  }

  const handlePreviewRule = () => {
    if (ruleConditions.length === 0 || ruleActions.length === 0) {
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Please add at least one condition and action',
      })
      return
    }

    previewRuleMutation.mutate({
      conditions: ruleConditions,
      actions: ruleActions,
    })
  }

  const handleToggleRule = (rule: Rule) => {
    updateRuleMutation.mutate({
      id: rule.id,
      updates: { isActive: !rule.isActive },
    })
  }

  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule? This action cannot be undone.')) {
      deleteRuleMutation.mutate(ruleId)
    }
  }

  const handleRunRetroactively = (ruleId: string) => {
    if (confirm('This will apply the rule to all existing transactions. Continue?')) {
      runRuleRetroactivelyMutation.mutate(ruleId)
    }
  }

  const getActionValueOptions = (actionType: string) => {
    switch (actionType) {
      case 'set_category':
        return categories?.map(cat => ({ label: cat.name, value: cat.id })) || []
      case 'add_tag':
        return [
          { label: 'Business', value: 'business' },
          { label: 'Personal', value: 'personal' },
          { label: 'Tax Deductible', value: 'tax_deductible' },
          { label: 'Recurring', value: 'recurring' },
        ]
      default:
        return []
    }
  }

  const getConditionValueOptions = (field: string) => {
    switch (field) {
      case 'category':
        return categories?.map(cat => ({ label: cat.name, value: cat.id })) || []
      case 'account':
        return accounts?.map(acc => ({ label: acc.name, value: acc.id })) || []
      default:
        return []
    }
  }

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Rules Engine
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create automated rules to categorize and manage transactions
            </p>
          </div>
          <Button
            label="Create Rule"
            icon={<PiPlus className="w-4 h-4" />}
            onClick={() => setShowCreateDialog(true)}
          />
        </div>

        {/* Rules List */}
        <Card title="Active Rules" className="card">
          {rulesLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : rules && rules.length > 0 ? (
            <div className="space-y-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={rule.isActive}
                        onChange={() => handleToggleRule(rule)}
                      />
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {rule.name}
                        </h3>
                        {rule.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {rule.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge value={`Priority ${rule.priority}`} severity="info" />
                    <Badge value={`${rule.affectedTransactions} transactions`} severity="secondary" />
                    {rule.lastRunAt && (
                      <span className="text-sm text-gray-500">
                        Last run: {formatDate(rule.lastRunAt)}
                      </span>
                    )}
                    <Button
                      icon={<PiEye className="w-4 h-4" />}
                      size="small"
                      className="p-button-text p-button-sm"
                      tooltip="Preview"
                    />
                    <Button
                      icon={<PiPlay className="w-4 h-4" />}
                      size="small"
                      className="p-button-text p-button-sm"
                      tooltip="Run Retroactively"
                      onClick={() => handleRunRetroactively(rule.id)}
                    />
                    <Button
                      icon={<PiTrash className="w-4 h-4" />}
                      size="small"
                      className="p-button-text p-button-sm p-button-danger"
                      tooltip="Delete"
                      onClick={() => handleDeleteRule(rule.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <PiGear className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Rules Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Create your first rule to automatically categorize transactions.
              </p>
            </div>
          )}
        </Card>

        {/* Create Rule Dialog */}
        <Dialog
          visible={showCreateDialog}
          onHide={() => setShowCreateDialog(false)}
          header="Create New Rule"
          modal
          className="p-fluid"
          style={{ width: '800px' }}
        >
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Rule Name</label>
                <InputText
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Enter rule name"
                  className="w-full"
                />
              </div>
              <div>
                <label className="label">Priority</label>
                <InputNumber
                  value={rulePriority}
                  onValueChange={(e) => setRulePriority(e.value || 1)}
                  min={1}
                  max={100}
                  className="w-full"
                />
              </div>
            </div>
            
            <div>
              <label className="label">Description</label>
              <InputTextarea
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="w-full"
              />
            </div>

            {/* Conditions */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Conditions
                </h3>
                <Button
                  label="Add Condition"
                  icon={<PiPlus className="w-4 h-4" />}
                  size="small"
                  onClick={addCondition}
                />
              </div>
              
              <div className="space-y-3">
                {ruleConditions.map((condition, index) => (
                  <div key={condition.id} className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-sm font-medium text-gray-500">IF</span>
                    
                    <Dropdown
                      value={condition.field}
                      options={CONDITION_FIELDS}
                      onChange={(e) => updateCondition(condition.id, 'field', e.value)}
                      className="w-32"
                    />
                    
                    <Dropdown
                      value={condition.operator}
                      options={CONDITION_OPERATORS[condition.field as keyof typeof CONDITION_OPERATORS] || []}
                      onChange={(e) => updateCondition(condition.id, 'operator', e.value)}
                      className="w-40"
                    />
                    
                    {condition.operator === 'between' ? (
                      <div className="flex items-center space-x-2">
                        <InputText
                          value={condition.value || ''}
                          onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                          placeholder="Min value"
                          className="w-24"
                        />
                        <span className="text-gray-500">and</span>
                        <InputText
                          value={condition.value2 || ''}
                          onChange={(e) => updateCondition(condition.id, 'value2', e.target.value)}
                          placeholder="Max value"
                          className="w-24"
                        />
                      </div>
                    ) : condition.field === 'amount' ? (
                      <InputNumber
                        value={condition.value}
                        onValueChange={(e) => updateCondition(condition.id, 'value', e.value)}
                        placeholder="Amount"
                        className="w-32"
                      />
                    ) : condition.field === 'date' ? (
                      <Calendar
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, 'value', e.value)}
                        className="w-32"
                      />
                    ) : ['category', 'account'].includes(condition.field) ? (
                      <Dropdown
                        value={condition.value}
                        options={getConditionValueOptions(condition.field)}
                        onChange={(e) => updateCondition(condition.id, 'value', e.value)}
                        placeholder="Select..."
                        className="w-48"
                      />
                    ) : (
                      <InputText
                        value={condition.value || ''}
                        onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                        placeholder="Value"
                        className="w-48"
                      />
                    )}
                    
                    <Button
                      icon={<PiTrash className="w-3 h-3" />}
                      size="small"
                      className="p-button-text p-button-sm p-button-danger"
                      onClick={() => removeCondition(condition.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Actions
                </h3>
                <Button
                  label="Add Action"
                  icon={<PiPlus className="w-4 h-4" />}
                  size="small"
                  onClick={addAction}
                />
              </div>
              
              <div className="space-y-3">
                {ruleActions.map((action, index) => (
                  <div key={action.id} className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-sm font-medium text-gray-500">THEN</span>
                    
                    <Dropdown
                      value={action.type}
                      options={ACTION_TYPES}
                      onChange={(e) => updateAction(action.id, 'type', e.value)}
                      className="w-40"
                    />
                    
                    {action.type === 'set_category' ? (
                      <Dropdown
                        value={action.value}
                        options={getActionValueOptions(action.type)}
                        onChange={(e) => updateAction(action.id, 'value', e.value)}
                        placeholder="Select category"
                        className="w-48"
                      />
                    ) : action.type === 'add_tag' ? (
                      <Dropdown
                        value={action.value}
                        options={getActionValueOptions(action.type)}
                        onChange={(e) => updateAction(action.id, 'value', e.value)}
                        placeholder="Select tag"
                        className="w-48"
                      />
                    ) : action.type === 'add_note' ? (
                      <InputText
                        value={action.value || ''}
                        onChange={(e) => updateAction(action.id, 'value', e.target.value)}
                        placeholder="Enter note"
                        className="w-48"
                      />
                    ) : action.type === 'create_alert' ? (
                      <InputText
                        value={action.value || ''}
                        onChange={(e) => updateAction(action.id, 'value', e.target.value)}
                        placeholder="Alert message"
                        className="w-48"
                      />
                    ) : null}
                    
                    <Button
                      icon={<PiTrash className="w-3 h-3" />}
                      size="small"
                      className="p-button-text p-button-sm p-button-danger"
                      onClick={() => removeAction(action.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Preview"
              icon={<PiEye className="w-4 h-4" />}
              onClick={handlePreviewRule}
              loading={previewRuleMutation.isLoading}
            />
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowCreateDialog(false)}
            />
            <Button
              label="Create Rule"
              onClick={handleCreateRule}
              loading={createRuleMutation.isLoading}
            />
          </div>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog
          visible={showPreviewDialog}
          onHide={() => setShowPreviewDialog(false)}
          header="Preview Affected Transactions"
          modal
          className="p-fluid"
          style={{ width: '900px' }}
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              This rule would affect {previewTransactions.length} transactions:
            </p>
            
            <DataTable value={previewTransactions} className="p-datatable-sm" scrollable scrollHeight="400px">
              <Column field="merchant" header="Merchant" />
              <Column field="amount" header="Amount" body={(rowData) => formatCurrency(rowData.amount, rowData.currency)} />
              <Column field="categoryName" header="Category" />
              <Column field="accountName" header="Account" />
              <Column field="date" header="Date" body={(rowData) => formatDate(rowData.date)} />
              <Column field="description" header="Description" />
              <Column field="isExcluded" header="Status" body={(rowData) => (
                <Badge value={rowData.isExcluded ? 'Excluded' : 'Active'} severity={rowData.isExcluded ? 'danger' : 'success'} />
              )} />
            </DataTable>
          </div>

          <div className="flex justify-end mt-6">
            <Button
              label="Close"
              onClick={() => setShowPreviewDialog(false)}
            />
          </div>
        </Dialog>
      </div>
    </MainLayout>
  )
}
