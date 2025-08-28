// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { ProgressSpinner } from 'primereact/progressspinner'
import { InputText } from 'primereact/inputtext'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiFilePdf, 
  PiFileCsv, 
  PiFileXls, 
  PiDownload,
  PiShare,
  PiEye,
  PiCalendar,
  PiChartLine,
  PiTrendUp,
  PiTrendDown,
  PiDollarSign,
  PiCreditCard,
  PiPiggyBank,
  PiWarning
} from 'react-icons/pi'

interface Report {
  id: string
  month: string
  year: number
  type: 'monthly' | 'quarterly' | 'annual'
  format: 'pdf' | 'csv' | 'xlsx'
  status: 'generating' | 'completed' | 'failed'
  downloadUrl?: string
  shareUrl?: string
  fileSize?: number
  createdAt: Date
  completedAt?: Date
}

interface ReportSummary {
  month: string
  totalIncome: number
  totalExpenses: number
  netSavings: number
  savingsRate: number
  topCategories: Array<{
    name: string
    amount: number
    percentage: number
  }>
  budgetStatus: {
    onTrack: number
    overBudget: number
    underBudget: number
  }
  anomalies: number
  goalsProgress: Array<{
    name: string
    current: number
    target: number
    percentage: number
  }>
}

const REPORT_TYPES = [
  { label: 'Monthly Report', value: 'monthly' },
  { label: 'Quarterly Report', value: 'quarterly' },
  { label: 'Annual Report', value: 'annual' },
]

const EXPORT_FORMATS = [
  { label: 'PDF Report', value: 'pdf' },
  { label: 'CSV Data', value: 'csv' },
  { label: 'Excel Spreadsheet', value: 'xlsx' },
]

export default function ReportsPage() {
  const { user } = useAuth()
  const toast = useRef<Toast>(null)
  
  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedReportType, setSelectedReportType] = useState('monthly')
  const [selectedFormat, setSelectedFormat] = useState('pdf')
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [shareUrl, setShareUrl] = useState('')

  // Fetch data
  const { data: reports, isLoading: reportsLoading } = useQuery<Report[]>(
    'reports',
    () => api.get('/reports').then(res => res.data),
    { refetchInterval: 30000 }
  )

  const { data: reportSummary, isLoading: summaryLoading } = useQuery<ReportSummary>(
    ['report-summary', format(selectedDate, 'yyyy-MM')],
    () => {
      const month = format(selectedDate, 'yyyy-MM')
      return api.get(`/reports/summary/${month}`).then(res => res.data)
    }
  )

  // Mutations
  const generateReportMutation = useMutation(
    (data: { month: string; type: string; format: string }) => 
      api.post('/reports/generate', data),
    {
      onSuccess: () => {
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Report generation started',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to generate report',
        })
      },
    }
  )

  const shareReportMutation = useMutation(
    (reportId: string) => api.post(`/reports/${reportId}/share`),
    {
      onSuccess: (data) => {
        setShareUrl(data.data.shareUrl)
        setShowShareDialog(true)
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Share link created',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to create share link',
        })
      },
    }
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleGenerateReport = () => {
    const month = format(selectedDate, 'yyyy-MM')
    generateReportMutation.mutate({
      month,
      type: selectedReportType,
      format: selectedFormat,
    })
  }

  const handleDownload = (report: Report) => {
    if (report.downloadUrl) {
      window.open(report.downloadUrl, '_blank')
    }
  }

  const handleShare = (report: Report) => {
    setSelectedReport(report)
    shareReportMutation.mutate(report.id)
  }

  const handleView = (report: Report) => {
    if (report.downloadUrl) {
      window.open(report.downloadUrl, '_blank')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'generating':
        return <ProgressSpinner style={{ width: '16px', height: '16px' }} />
      case 'completed':
        return <PiFilePdf className="w-4 h-4 text-success-600" />
      case 'failed':
        return <PiWarning className="w-4 h-4 text-danger-600" />
      default:
        return <PiFilePdf className="w-4 h-4 text-gray-600" />
    }
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <PiFilePdf className="w-4 h-4 text-red-600" />
      case 'csv':
        return <PiFileCsv className="w-4 h-4 text-green-600" />
      case 'xlsx':
        return <PiFileXls className="w-4 h-4 text-blue-600" />
      default:
        return <PiFilePdf className="w-4 h-4 text-gray-600" />
    }
  }

  const filteredReports = reports?.filter(report => {
    const reportDate = new Date(report.year, parseInt(report.month) - 1)
    const selectedMonth = startOfMonth(selectedDate)
    const selectedEnd = endOfMonth(selectedDate)
    return reportDate >= selectedMonth && reportDate <= selectedEnd
  }) || []

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Reports
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Generate and manage your financial reports
            </p>
          </div>
        </div>

        {/* Report Summary */}
        {summaryLoading ? (
          <Card className="card">
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          </Card>
        ) : reportSummary ? (
          <Card title={`${format(selectedDate, 'MMMM yyyy')} Summary`} className="card">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-success-100 dark:bg-success-900 rounded-lg mx-auto mb-3">
                  <PiTrendUp className="w-6 h-6 text-success-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Income
                </p>
                <p className="text-2xl font-bold text-success-600">
                  {formatCurrency(reportSummary.totalIncome)}
                </p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-danger-100 dark:bg-danger-900 rounded-lg mx-auto mb-3">
                  <PiTrendDown className="w-6 h-6 text-danger-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Expenses
                </p>
                <p className="text-2xl font-bold text-danger-600">
                  {formatCurrency(reportSummary.totalExpenses)}
                </p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg mx-auto mb-3">
                  <PiPiggyBank className="w-6 h-6 text-primary-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Net Savings
                </p>
                <p className="text-2xl font-bold text-primary-600">
                  {formatCurrency(reportSummary.netSavings)}
                </p>
                <p className="text-sm text-gray-500">
                  {reportSummary.savingsRate.toFixed(1)}% rate
                </p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-warning-100 dark:bg-warning-900 rounded-lg mx-auto mb-3">
                  <PiWarning className="w-6 h-6 text-warning-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Anomalies
                </p>
                <p className="text-2xl font-bold text-warning-600">
                  {reportSummary.anomalies}
                </p>
              </div>
            </div>

            {/* Top Categories */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Top Spending Categories
              </h3>
              <div className="space-y-3">
                {reportSummary.topCategories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 bg-primary-100 dark:bg-primary-900 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {category.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(category.amount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {category.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {/* Generate Report */}
        <Card title="Generate New Report" className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="label">Month</label>
              <Calendar
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.value as Date)}
                view="month"
                dateFormat="MM/yy"
                className="w-full"
              />
            </div>
            
            <div>
              <label className="label">Report Type</label>
              <Dropdown
                value={selectedReportType}
                options={REPORT_TYPES}
                onChange={(e) => setSelectedReportType(e.value)}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="label">Format</label>
              <Dropdown
                value={selectedFormat}
                options={EXPORT_FORMATS}
                onChange={(e) => setSelectedFormat(e.value)}
                className="w-full"
              />
            </div>
            
            <div>
              <Button
                label="Generate Report"
                icon={<PiFilePdf className="w-4 h-4" />}
                onClick={handleGenerateReport}
                loading={generateReportMutation.isLoading}
                className="w-full"
              />
            </div>
          </div>
        </Card>

        {/* Reports List */}
        <Card title="Generated Reports" className="card">
          {reportsLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : filteredReports.length > 0 ? (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(report.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        {getFormatIcon(report.format)}
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report - {report.month}/{report.year}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Generated {format(new Date(report.createdAt), 'MMM dd, yyyy HH:mm')}
                        {report.fileSize && ` • ${formatFileSize(report.fileSize)}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {report.status === 'completed' && (
                      <>
                        <Button
                          icon={<PiEye className="w-4 h-4" />}
                          size="small"
                          className="p-button-text p-button-sm"
                          tooltip="View Report"
                          onClick={() => handleView(report)}
                        />
                        <Button
                          icon={<PiDownload className="w-4 h-4" />}
                          size="small"
                          className="p-button-text p-button-sm"
                          tooltip="Download"
                          onClick={() => handleDownload(report)}
                        />
                        <Button
                          icon={<PiShare className="w-4 h-4" />}
                          size="small"
                          className="p-button-text p-button-sm"
                          tooltip="Share"
                          onClick={() => handleShare(report)}
                        />
                      </>
                    )}
                    {report.status === 'generating' && (
                      <span className="text-sm text-gray-500">Generating...</span>
                    )}
                    {report.status === 'failed' && (
                      <span className="text-sm text-danger-500">Failed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <PiFilePdf className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Reports Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Generate your first report to get started.
              </p>
            </div>
          )}
        </Card>

        {/* Share Dialog */}
        <Dialog
          visible={showShareDialog}
          onHide={() => setShowShareDialog(false)}
          header="Share Report"
          modal
          className="p-fluid"
          style={{ width: '500px' }}
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Share this read-only link with others. The link will expire in 30 days.
            </p>
            <div className="flex space-x-2">
              <InputText
                value={shareUrl}
                readOnly
                className="flex-1"
                placeholder="Share URL will appear here..."
              />
              <Button
                label="Copy"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl)
                  toast.current?.show({
                    severity: 'success',
                    summary: 'Copied',
                    detail: 'Share link copied to clipboard',
                  })
                }}
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button
              label="Close"
              onClick={() => setShowShareDialog(false)}
            />
          </div>
        </Dialog>
      </div>
    </MainLayout>
  )
}
