// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState, useRef } from 'react'
import { useQuery } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { Toast } from 'primereact/toast'
import { Badge } from 'primereact/badge'
import { ProgressSpinner } from 'primereact/progressspinner'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar } from 'recharts'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiTrendingUp, 
  PiTrendingDown, 
  PiChartLine,
  PiCalendar,
  PiWarning,
  PiCheckCircle,
  PiXCircle,
  PiInfo,
  PiRefresh
} from 'react-icons/pi'

interface Forecast {
  id: string
  type: 'cashflow' | 'category' | 'account'
  targetId: string
  targetName: string
  period: '30d' | '90d' | '180d' | '1y'
  data: Array<{
    date: string
    p50: number
    p90: number
    p10: number
    actual?: number
  }>
  summary: {
    trend: 'up' | 'down' | 'stable'
    confidence: number
    nextValue: number
    changePercent: number
  }
  createdAt: Date
  updatedAt: Date
}

interface UpcomingBill {
  id: string
  merchant: string
  amount: number
  currency: string
  dueDate: Date
  status: 'upcoming' | 'due_soon' | 'overdue'
  accountId: string
  accountName: string
  categoryId: string
  categoryName: string
}

interface CategoryForecast {
  categoryId: string
  categoryName: string
  categoryColor: string
  currentMonth: number
  nextMonth: number
  changePercent: number
  trend: 'up' | 'down' | 'stable'
}

const FORECAST_PERIODS = [
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: '6 Months', value: '180d' },
  { label: '1 Year', value: '1y' },
]

const FORECAST_TYPES = [
  { label: 'Cash Flow', value: 'cashflow' },
  { label: 'Categories', value: 'category' },
  { label: 'Accounts', value: 'account' },
]

export default function ForecastsPage() {
  const { user } = useAuth()
  const toast = useRef<Toast>(null)
  
  // State
  const [selectedPeriod, setSelectedPeriod] = useState('90d')
  const [selectedType, setSelectedType] = useState('cashflow')

  // Fetch data
  const { data: cashflowForecast, isLoading: cashflowLoading } = useQuery<Forecast>(
    ['forecast', 'cashflow', selectedPeriod],
    () => api.get(`/forecasts/cashflow?period=${selectedPeriod}`).then(res => res.data),
    { refetchInterval: 300000 } // 5 minutes
  )

  const { data: categoryForecasts, isLoading: categoryForecastsLoading } = useQuery<CategoryForecast[]>(
    ['forecasts', 'categories'],
    () => api.get('/forecasts/categories').then(res => res.data),
    { refetchInterval: 300000 }
  )

  const { data: upcomingBills, isLoading: billsLoading } = useQuery<UpcomingBill[]>(
    ['forecasts', 'upcoming-bills'],
    () => api.get('/forecasts/upcoming-bills').then(res => res.data),
    { refetchInterval: 60000 } // 1 minute
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <PiTrendingUp className="w-4 h-4 text-success-600" />
      case 'down':
        return <PiTrendingDown className="w-4 h-4 text-danger-600" />
      default:
        return <PiInfo className="w-4 h-4 text-info-600" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-success-600'
      case 'down':
        return 'text-danger-600'
      default:
        return 'text-info-600'
    }
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

  const totalUpcomingBills = upcomingBills?.reduce((sum, bill) => sum + bill.amount, 0) || 0
  const overdueBills = upcomingBills?.filter(bill => bill.status === 'overdue') || []
  const dueSoonBills = upcomingBills?.filter(bill => bill.status === 'due_soon') || []

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Forecasts
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              AI-powered financial predictions and insights
            </p>
          </div>
          <div className="flex space-x-2">
            <Dropdown
              value={selectedPeriod}
              options={FORECAST_PERIODS}
              onChange={(e) => setSelectedPeriod(e.value)}
              className="w-32"
            />
            <Dropdown
              value={selectedType}
              options={FORECAST_TYPES}
              onChange={(e) => setSelectedType(e.value)}
              className="w-40"
            />
            <Button
              icon={<PiRefresh className="w-4 h-4" />}
              className="p-button-outlined"
              onClick={() => window.location.reload()}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Cash Flow Trend
                </p>
                <p className={`text-2xl font-bold ${getTrendColor(cashflowForecast?.summary.trend || 'stable')}`}>
                  {cashflowForecast?.summary.trend === 'up' ? '+' : ''}{cashflowForecast?.summary.changePercent.toFixed(1) || '0'}%
                </p>
              </div>
              <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
                {getTrendIcon(cashflowForecast?.summary.trend || 'stable')}
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Next Month Prediction
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {cashflowForecast?.summary.nextValue ? formatCurrency(cashflowForecast.summary.nextValue) : '$0.00'}
                </p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-900 rounded-lg">
                <PiChartLine className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Upcoming Bills
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(totalUpcomingBills)}
                </p>
              </div>
              <div className="p-3 bg-warning-100 dark:bg-warning-900 rounded-lg">
                <PiCalendar className="w-6 h-6 text-warning-600" />
              </div>
            </div>
          </Card>

          <Card className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Forecast Confidence
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {cashflowForecast?.summary.confidence ? (cashflowForecast.summary.confidence * 100).toFixed(0) : '0'}%
                </p>
              </div>
              <div className="p-3 bg-info-100 dark:bg-info-900 rounded-lg">
                <PiInfo className="w-6 h-6 text-info-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Cash Flow Forecast Chart */}
        <Card title="Cash Flow Forecast" className="card">
          {cashflowLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : cashflowForecast?.data && cashflowForecast.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={cashflowForecast.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value, 'USD')}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    formatCurrency(value, 'USD'), 
                    name === 'p50' ? 'Median' : name === 'p90' ? '90th Percentile' : name === 'p10' ? '10th Percentile' : 'Actual'
                  ]}
                  labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                />
                <Area 
                  type="monotone" 
                  dataKey="p90" 
                  stackId="1"
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.1}
                  name="90th Percentile"
                />
                <Area 
                  type="monotone" 
                  dataKey="p50" 
                  stackId="1"
                  stroke="#10B981" 
                  fill="#10B981" 
                  fillOpacity={0.3}
                  name="Median"
                />
                <Area 
                  type="monotone" 
                  dataKey="p10" 
                  stackId="1"
                  stroke="#EF4444" 
                  fill="#EF4444" 
                  fillOpacity={0.1}
                  name="10th Percentile"
                />
                {cashflowForecast.data.some(d => d.actual !== undefined) && (
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="#8B5CF6" 
                    strokeWidth={3}
                    dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                    name="Actual"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No forecast data available
            </div>
          )}
        </Card>

        {/* Category Forecasts */}
        <Card title="Category Spending Forecasts" className="card">
          {categoryForecastsLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : categoryForecasts && categoryForecasts.length > 0 ? (
            <div className="space-y-4">
              {categoryForecasts.map((forecast) => (
                <div key={forecast.categoryId} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: forecast.categoryColor }}
                      />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {forecast.categoryName}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Current: {formatCurrency(forecast.currentMonth)} | Next: {formatCurrency(forecast.nextMonth)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(forecast.trend)}
                      <Badge 
                        value={`${forecast.changePercent >= 0 ? '+' : ''}${forecast.changePercent.toFixed(1)}%`}
                        severity={forecast.trend === 'up' ? 'danger' : forecast.trend === 'down' ? 'success' : 'info'}
                      />
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        forecast.trend === 'up' ? 'bg-danger-600' : 
                        forecast.trend === 'down' ? 'bg-success-600' : 'bg-info-600'
                      }`}
                      style={{ 
                        width: `${Math.min(Math.abs(forecast.changePercent) * 2, 100)}%`,
                        marginLeft: forecast.changePercent < 0 ? 'auto' : '0'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No category forecasts available
            </div>
          )}
        </Card>

        {/* Upcoming Bills */}
        <Card title="Upcoming Bills" className="card">
          {billsLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : upcomingBills && upcomingBills.length > 0 ? (
            <div className="space-y-4">
              {/* Alerts */}
              {(overdueBills.length > 0 || dueSoonBills.length > 0) && (
                <div className="space-y-3">
                  {overdueBills.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <PiXCircle className="w-5 h-5 text-danger-600" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {bill.merchant} - {formatCurrency(bill.amount, bill.currency)}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Overdue since {formatDate(bill.dueDate)}
                          </p>
                        </div>
                      </div>
                      <Badge value="Overdue" severity="danger" />
                    </div>
                  ))}

                  {dueSoonBills.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <PiWarning className="w-5 h-5 text-warning-600" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {bill.merchant} - {formatCurrency(bill.amount, bill.currency)}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Due on {formatDate(bill.dueDate)}
                          </p>
                        </div>
                      </div>
                      <Badge value="Due Soon" severity="warning" />
                    </div>
                  ))}
                </div>
              )}

              {/* All Bills */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingBills.map((bill) => (
                  <div key={bill.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {bill.merchant}
                      </h4>
                      <Badge 
                        value={getStatusText(bill.status)} 
                        severity={getStatusColor(bill.status)}
                      />
                    </div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {formatCurrency(bill.amount, bill.currency)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Due: {formatDate(bill.dueDate)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Account: {bill.accountName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No upcoming bills found
            </div>
          )}
        </Card>

        {/* Forecast Insights */}
        <Card title="AI Insights" className="card">
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <PiInfo className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Spending Pattern Detected
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your spending typically increases by 15% in the first week of each month. 
                    Consider setting aside additional funds during this period.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <PiCheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Positive Trend
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your savings rate has improved by 8% over the last 3 months. 
                    At this rate, you'll reach your emergency fund goal 2 months early.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <PiWarning className="w-5 h-5 text-warning-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Budget Alert
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your dining out category is projected to exceed budget by 12% next month. 
                    Consider reducing restaurant visits to stay on track.
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
