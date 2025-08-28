// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useEffect, useState } from 'react'
import { useQuery } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { ProgressBar } from 'primereact/progressbar'
import { Badge } from 'primereact/badge'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiTrendingUp, 
  PiTrendingDown, 
  PiCreditCard, 
  PiWallet, 
  PiWarning, 
  PiTarget,
  PiChartLine,
  PiReceipt
} from 'react-icons/pi'

interface DashboardOverview {
  netWorth: {
    current: number;
    change: number;
    changePercent: number;
  };
  upcomingBills: {
    count: number;
    totalAmount: number;
    nextDue: Date | null;
  };
  budgetStatus: {
    totalBudget: number;
    totalSpent: number;
    remaining: number;
    utilizationPercent: number;
  };
  recentAnomalies: {
    count: number;
    unreadCount: number;
  };
  accountBalances: {
    total: number;
    accounts: Array<{
      id: string;
      name: string;
      balance: number;
      currency: string;
    }>;
  };
  goalsProgress: {
    totalGoals: number;
    completedGoals: number;
    totalTarget: number;
    totalSaved: number;
  };
}

interface NetWorthTrend {
  period: string;
  data: Array<{
    date: string;
    netWorth: number;
    assets: number;
    liabilities: number;
  }>;
  summary: {
    startValue: number;
    endValue: number;
    change: number;
    changePercent: number;
  };
}

interface UpcomingBill {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: 'upcoming' | 'due_soon' | 'overdue';
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
}

interface SpendingSummary {
  period: string;
  totalSpent: number;
  categories: Array<{
    id: string;
    name: string;
    amount: number;
    percent: number;
    color: string;
  }>;
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316']

export default function DashboardPage() {
  const { user } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState<'30d' | '90d' | '1y' | 'all'>('90d')

  // Fetch dashboard data
  const { data: overview, isLoading: overviewLoading } = useQuery<DashboardOverview>(
    'dashboard-overview',
    () => api.get('/dashboard/overview').then(res => res.data),
    { refetchInterval: 30000 } // Refresh every 30 seconds
  )

  const { data: netWorthTrend, isLoading: netWorthLoading } = useQuery<NetWorthTrend>(
    ['net-worth-trend', selectedPeriod],
    () => api.get(`/dashboard/net-worth?period=${selectedPeriod}`).then(res => res.data),
    { refetchInterval: 60000 } // Refresh every minute
  )

  const { data: upcomingBills, isLoading: billsLoading } = useQuery<UpcomingBill[]>(
    'upcoming-bills',
    () => api.get('/dashboard/upcoming-bills?days=30').then(res => res.data),
    { refetchInterval: 300000 } // Refresh every 5 minutes
  )

  const { data: spendingSummary, isLoading: spendingLoading } = useQuery<SpendingSummary>(
    'spending-summary',
    () => api.get('/dashboard/spending-summary?period=current_month').then(res => res.data),
    { refetchInterval: 300000 } // Refresh every 5 minutes
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
      case 'overdue':
        return 'danger'
      case 'due_soon':
        return 'warning'
      case 'upcoming':
        return 'info'
      default:
        return 'info'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'Overdue'
      case 'due_soon':
        return 'Due Soon'
      case 'upcoming':
        return 'Upcoming'
      default:
        return 'Unknown'
    }
  }

  if (overviewLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back, {user?.firstName}!
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              label="Refresh"
              icon="pi pi-refresh"
              className="p-button-outlined"
              onClick={() => window.location.reload()}
            />
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Net Worth Card */}
          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Net Worth
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {overview?.netWorth.current ? formatCurrency(overview.netWorth.current) : '$0.00'}
                </p>
                <div className="flex items-center mt-2">
                  {overview?.netWorth.changePercent && overview.netWorth.changePercent >= 0 ? (
                    <PiTrendingUp className="w-4 h-4 text-success-600 mr-1" />
                  ) : (
                    <PiTrendingDown className="w-4 h-4 text-danger-600 mr-1" />
                  )}
                  <span className={`text-sm font-medium ${
                    overview?.netWorth.changePercent && overview.netWorth.changePercent >= 0 
                      ? 'text-success-600' 
                      : 'text-danger-600'
                  }`}>
                    {overview?.netWorth.changePercent ? Math.abs(overview.netWorth.changePercent).toFixed(1) : '0'}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last month</span>
                </div>
              </div>
              <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <PiChartLine className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Card>

          {/* Upcoming Bills Card */}
          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Upcoming Bills
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {overview?.upcomingBills.count || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {overview?.upcomingBills.totalAmount ? formatCurrency(overview.upcomingBills.totalAmount) : '$0.00'} total
                </p>
                {overview?.upcomingBills.nextDue && (
                  <p className="text-sm text-gray-500">
                    Next due: {formatDate(overview.upcomingBills.nextDue)}
                  </p>
                )}
              </div>
              <div className="p-3 bg-warning-100 dark:bg-warning-900 rounded-lg">
                <PiReceipt className="w-6 h-6 text-warning-600" />
              </div>
            </div>
          </Card>

          {/* Budget Status Card */}
          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Budget Status
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {overview?.budgetStatus.utilizationPercent ? overview.budgetStatus.utilizationPercent.toFixed(0) : '0'}%
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {overview?.budgetStatus.remaining ? formatCurrency(overview.budgetStatus.remaining) : '$0.00'} remaining
                </p>
                <ProgressBar 
                  value={overview?.budgetStatus.utilizationPercent || 0} 
                  className="mt-2"
                  color={overview?.budgetStatus.utilizationPercent && overview.budgetStatus.utilizationPercent > 90 ? 'red' : 'blue'}
                />
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-900 rounded-lg">
                <PiWallet className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </Card>

          {/* Recent Anomalies Card */}
          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Recent Anomalies
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {overview?.recentAnomalies.count || 0}
                </p>
                {overview?.recentAnomalies.unreadCount && overview.recentAnomalies.unreadCount > 0 && (
                  <Badge value={overview.recentAnomalies.unreadCount} severity="danger" className="mt-1" />
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {overview?.recentAnomalies.unreadCount || 0} unread
                </p>
              </div>
              <div className="p-3 bg-danger-100 dark:bg-danger-900 rounded-lg">
                <PiWarning className="w-6 h-6 text-danger-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Net Worth Trend Chart */}
          <Card title="Net Worth Trend" className="card">
            <div className="mb-4">
              <div className="flex space-x-2">
                {(['30d', '90d', '1y', 'all'] as const).map((period) => (
                  <Button
                    key={period}
                    label={period.toUpperCase()}
                    size="small"
                    className={`p-button-sm ${
                      selectedPeriod === period ? 'p-button-primary' : 'p-button-outlined'
                    }`}
                    onClick={() => setSelectedPeriod(period)}
                  />
                ))}
              </div>
            </div>
            {netWorthLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : netWorthTrend?.data && netWorthTrend.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={netWorthTrend.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value, 'USD')}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(value, 'USD'), 'Net Worth']}
                    labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="netWorth" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No data available
              </div>
            )}
          </Card>

          {/* Spending by Category Chart */}
          <Card title="Spending by Category" className="card">
            {spendingLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : spendingSummary?.categories && spendingSummary.categories.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={spendingSummary.categories}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {spendingSummary.categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(value, 'USD'), 'Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No spending data available
              </div>
            )}
          </Card>
        </div>

        {/* Upcoming Bills Table */}
        <Card title="Upcoming Bills" className="card">
          {billsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : upcomingBills && upcomingBills.length > 0 ? (
            <DataTable value={upcomingBills} paginator rows={5} className="p-datatable-sm">
              <Column field="merchant" header="Merchant" />
              <Column 
                field="amount" 
                header="Amount" 
                body={(rowData) => formatCurrency(rowData.amount, rowData.currency)}
              />
              <Column 
                field="dueDate" 
                header="Due Date" 
                body={(rowData) => formatDate(rowData.dueDate)}
              />
              <Column 
                field="status" 
                header="Status" 
                body={(rowData) => (
                  <Badge 
                    value={getStatusText(rowData.status)} 
                    severity={getStatusColor(rowData.status)}
                  />
                )}
              />
              <Column field="accountName" header="Account" />
              <Column field="categoryName" header="Category" />
            </DataTable>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No upcoming bills
            </div>
          )}
        </Card>

        {/* Account Balances */}
        <Card title="Account Balances" className="card">
          {overview?.accountBalances.accounts && overview.accountBalances.accounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overview.accountBalances.accounts.map((account) => (
                <div key={account.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {account.name}
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(account.balance, account.currency)}
                      </p>
                    </div>
                    <PiCreditCard className="w-6 h-6 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No accounts found
            </div>
          )}
        </Card>

        {/* Goals Progress */}
        <Card title="Goals Progress" className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center">
                <PiTarget className="w-6 h-6 text-primary-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Total Goals
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {overview?.goalsProgress.totalGoals || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center">
                <PiTarget className="w-6 h-6 text-success-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Completed
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {overview?.goalsProgress.completedGoals || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center">
                <PiTarget className="w-6 h-6 text-warning-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Total Saved
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {overview?.goalsProgress.totalSaved ? formatCurrency(overview.goalsProgress.totalSaved) : '$0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  )
}
