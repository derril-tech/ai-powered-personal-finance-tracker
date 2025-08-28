// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { ProgressSpinner } from 'primereact/progressspinner'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Badge } from 'primereact/badge'
import { Steps } from 'primereact/steps'
import { FileUpload } from 'primereact/fileupload'
import { Calendar } from 'primereact/calendar'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiUpload, 
  PiFileCsv, 
  PiFilePdf, 
  PiFileText,
  PiCheck,
  PiX,
  PiWarning,
  PiEye,
  PiDownload,
  PiTrash,
  PiArrowRight,
  PiArrowLeft,
  PiMapPin,
  PiCalendar,
  PiDollarSign,
  PiBuilding,
  PiTag,
  PiFile,
  PiGear,
  PiPlay,
  PiPause
} from 'react-icons/pi'

interface ImportJob {
  id: string
  name: string
  type: 'csv' | 'ofx' | 'qif' | 'mt940' | 'pdf'
  status: 'uploading' | 'mapping' | 'validating' | 'processing' | 'completed' | 'failed'
  fileName: string
  fileSize: number
  totalRows: number
  processedRows: number
  errorRows: number
  accountId?: string
  accountName?: string
  mappingConfig?: any
  errors?: ImportError[]
  createdAt: Date
  completedAt?: Date
}

interface ImportError {
  row: number
  field: string
  message: string
  value?: string
}

interface Account {
  id: string
  name: string
  type: string
  institutionName: string
}

interface ColumnMapping {
  sourceColumn: string
  targetField: 'date' | 'amount' | 'description' | 'merchant' | 'category' | 'account' | 'skip'
  format?: string
  transform?: string
}

const IMPORT_TYPES = [
  { label: 'CSV File', value: 'csv', icon: <PiFileCsv className="w-4 h-4" /> },
  { label: 'OFX File', value: 'ofx', icon: <PiFileText className="w-4 h-4" /> },
  { label: 'QIF File', value: 'qif', icon: <PiFileText className="w-4 h-4" /> },
  { label: 'MT940 File', value: 'mt940', icon: <PiFileText className="w-4 h-4" /> },
  { label: 'PDF Statement', value: 'pdf', icon: <PiFilePdf className="w-4 h-4" /> },
]

const TARGET_FIELDS = [
  { label: 'Date', value: 'date', icon: <PiCalendar className="w-4 h-4" /> },
  { label: 'Amount', value: 'amount', icon: <PiDollarSign className="w-4 h-4" /> },
  { label: 'Description', value: 'description', icon: <PiFileText className="w-4 h-4" /> },
  { label: 'Merchant', value: 'merchant', icon: <PiBuilding className="w-4 h-4" /> },
  { label: 'Category', value: 'category', icon: <PiTag className="w-4 h-4" /> },
  { label: 'Account', value: 'account', icon: <PiGear className="w-4 h-4" /> },
  { label: 'Skip Column', value: 'skip', icon: <PiX className="w-4 h-4" /> },
]

const DATE_FORMATS = [
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'MM-DD-YYYY', value: 'MM-DD-YYYY' },
  { label: 'DD-MM-YYYY', value: 'DD-MM-YYYY' },
]

const STEPS = [
  { label: 'Upload File', icon: <PiUpload className="w-4 h-4" /> },
  { label: 'Map Columns', icon: <PiMapPin className="w-4 h-4" /> },
  { label: 'Review & Import', icon: <PiEye className="w-4 h-4" /> },
]

export default function ImportPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useRef<Toast>(null)
  const fileUploadRef = useRef<FileUpload>(null)
  
  // State
  const [activeStep, setActiveStep] = useState(0)
  const [selectedImportType, setSelectedImportType] = useState('csv')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null)

  // Fetch data
  const { data: importJobs, isLoading: jobsLoading } = useQuery<ImportJob[]>(
    'import-jobs',
    () => api.get('/imports').then(res => res.data),
    { refetchInterval: 5000 }
  )

  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>(
    'accounts',
    () => api.get('/accounts').then(res => res.data),
    { refetchInterval: 300000 }
  )

  // Mutations
  const uploadFileMutation = useMutation(
    (data: FormData) => api.post('/imports/upload', data),
    {
      onSuccess: (data) => {
        setColumnMappings(data.data.mappings)
        setPreviewData(data.data.preview)
        setActiveStep(1)
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'File uploaded successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to upload file',
        })
      },
    }
  )

  const validateMappingMutation = useMutation(
    (data: { mappings: ColumnMapping[]; accountId: string }) => 
      api.post('/imports/validate', data),
    {
      onSuccess: (data) => {
        setPreviewData(data.data.preview)
        setActiveStep(2)
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Mapping validated successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to validate mapping',
        })
      },
    }
  )

  const startImportMutation = useMutation(
    (data: { mappings: ColumnMapping[]; accountId: string }) => 
      api.post('/imports/start', data),
    {
      onSuccess: () => {
        setActiveStep(0)
        resetForm()
        queryClient.invalidateQueries('import-jobs')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Import started successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to start import',
        })
      },
    }
  )

  const deleteImportMutation = useMutation(
    (jobId: string) => api.delete(`/imports/${jobId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('import-jobs')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Import deleted successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to delete import',
        })
      },
    }
  )

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (date: Date) => {
    return format(new Date(date), 'MMM dd, yyyy HH:mm')
  }

  const resetForm = () => {
    setSelectedImportType('csv')
    setSelectedAccount('')
    setUploadedFile(null)
    setColumnMappings([])
    setPreviewData([])
    setActiveStep(0)
  }

  const handleFileUpload = (event: any) => {
    const file = event.files[0]
    if (!file) return

    setUploadedFile(file)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', selectedImportType)
    formData.append('accountId', selectedAccount)

    uploadFileMutation.mutate(formData)
  }

  const handleMappingChange = (sourceColumn: string, field: keyof ColumnMapping, value: any) => {
    setColumnMappings(columnMappings.map(mapping => 
      mapping.sourceColumn === sourceColumn ? { ...mapping, [field]: value } : mapping
    ))
  }

  const handleValidateMapping = () => {
    if (!selectedAccount) {
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Please select an account',
      })
      return
    }

    validateMappingMutation.mutate({
      mappings: columnMappings,
      accountId: selectedAccount,
    })
  }

  const handleStartImport = () => {
    startImportMutation.mutate({
      mappings: columnMappings,
      accountId: selectedAccount,
    })
  }

  const handleDeleteImport = (jobId: string) => {
    if (confirm('Are you sure you want to delete this import? This action cannot be undone.')) {
      deleteImportMutation.mutate(jobId)
    }
  }

  const handleViewErrors = (job: ImportJob) => {
    setSelectedJob(job)
    setShowErrorDialog(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <PiUpload className="w-4 h-4 text-info-600" />
      case 'mapping':
        return <PiMapPin className="w-4 h-4 text-warning-600" />
      case 'validating':
        return <PiCheck className="w-4 h-4 text-warning-600" />
      case 'processing':
        return <ProgressSpinner style={{ width: '16px', height: '16px' }} />
      case 'completed':
        return <PiCheck className="w-4 h-4 text-success-600" />
      case 'failed':
        return <PiX className="w-4 h-4 text-danger-600" />
      default:
        return <PiFile className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading':
      case 'mapping':
      case 'validating':
        return 'warning'
      case 'processing':
        return 'info'
      case 'completed':
        return 'success'
      case 'failed':
        return 'danger'
      default:
        return 'secondary'
    }
  }

  const accountOptions = accounts?.map(acc => ({
    label: `${acc.name} (${acc.institutionName})`,
    value: acc.id,
  })) || []

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Import Data
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Import transactions from various file formats
            </p>
          </div>
        </div>

        {/* Import Wizard */}
        <Card className="card">
          <Steps model={STEPS} activeIndex={activeStep} />
          
          <div className="mt-8">
            {/* Step 1: Upload File */}
            {activeStep === 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Import Type</label>
                    <Dropdown
                      value={selectedImportType}
                      options={IMPORT_TYPES}
                      onChange={(e) => setSelectedImportType(e.value)}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="label">Target Account</label>
                    <Dropdown
                      value={selectedAccount}
                      options={accountOptions}
                      onChange={(e) => setSelectedAccount(e.value)}
                      placeholder="Select account"
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label">Upload File</label>
                  <FileUpload
                    ref={fileUploadRef}
                    name="file"
                    url="/api/imports/upload"
                    accept={selectedImportType === 'csv' ? '.csv' : selectedImportType === 'pdf' ? '.pdf' : '.ofx,.qif,.sta'}
                    maxFileSize={10000000}
                    customUpload
                    uploadHandler={handleFileUpload}
                    auto
                    chooseLabel="Choose File"
                    uploadLabel="Upload"
                    cancelLabel="Cancel"
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Map Columns */}
            {activeStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Map Columns
                  </h3>
                  
                  <div className="space-y-3">
                    {columnMappings.map((mapping) => (
                      <div key={mapping.sourceColumn} className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {mapping.sourceColumn}
                          </label>
                        </div>
                        
                        <PiArrowRight className="w-4 h-4 text-gray-400" />
                        
                        <Dropdown
                          value={mapping.targetField}
                          options={TARGET_FIELDS}
                          onChange={(e) => handleMappingChange(mapping.sourceColumn, 'targetField', e.value)}
                          className="w-48"
                        />
                        
                        {mapping.targetField === 'date' && (
                          <Dropdown
                            value={mapping.format}
                            options={DATE_FORMATS}
                            onChange={(e) => handleMappingChange(mapping.sourceColumn, 'format', e.value)}
                            placeholder="Date format"
                            className="w-32"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button
                    label="Back"
                    icon={<PiArrowLeft className="w-4 h-4" />}
                    className="p-button-outlined"
                    onClick={() => setActiveStep(0)}
                  />
                  <Button
                    label="Validate & Preview"
                    icon={<PiEye className="w-4 h-4" />}
                    onClick={handleValidateMapping}
                    loading={validateMappingMutation.isLoading}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Review & Import */}
            {activeStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Preview Data
                  </h3>
                  
                  <DataTable value={previewData.slice(0, 10)} className="p-datatable-sm">
                    {Object.keys(previewData[0] || {}).map((key) => (
                      <Column key={key} field={key} header={key} />
                    ))}
                  </DataTable>
                  
                  <p className="text-sm text-gray-500 mt-2">
                    Showing first 10 rows of {previewData.length} total rows
                  </p>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button
                    label="Back"
                    icon={<PiArrowLeft className="w-4 h-4" />}
                    className="p-button-outlined"
                    onClick={() => setActiveStep(1)}
                  />
                  <Button
                    label="Start Import"
                    icon={<PiPlay className="w-4 h-4" />}
                    onClick={handleStartImport}
                    loading={startImportMutation.isLoading}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Import Jobs */}
        <Card title="Import History" className="card">
          {jobsLoading ? (
            <div className="flex items-center justify-center h-64">
              <ProgressSpinner />
            </div>
          ) : importJobs && importJobs.length > 0 ? (
            <div className="space-y-4">
              {importJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(job.status)}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {job.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {job.fileName} • {formatFileSize(job.fileSize)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <Badge value={job.status.toUpperCase()} severity={getStatusColor(job.status)} />
                      <p className="text-sm text-gray-500 mt-1">
                        {job.processedRows}/{job.totalRows} rows
                        {job.errorRows > 0 && ` • ${job.errorRows} errors`}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {job.errors && job.errors.length > 0 && (
                        <Button
                          icon={<PiWarning className="w-4 h-4" />}
                          size="small"
                          className="p-button-text p-button-sm"
                          tooltip="View Errors"
                          onClick={() => handleViewErrors(job)}
                        />
                      )}
                      <Button
                        icon={<PiTrash className="w-4 h-4" />}
                        size="small"
                        className="p-button-text p-button-sm p-button-danger"
                        tooltip="Delete"
                        onClick={() => handleDeleteImport(job.id)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <PiUpload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Imports Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Start by uploading your first file to import transactions.
              </p>
            </div>
          )}
        </Card>

        {/* Error Dialog */}
        <Dialog
          visible={showErrorDialog}
          onHide={() => setShowErrorDialog(false)}
          header="Import Errors"
          modal
          className="p-fluid"
          style={{ width: '800px' }}
        >
          {selectedJob && (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Found {selectedJob.errors?.length || 0} errors in the import:
              </p>
              
              <DataTable value={selectedJob.errors || []} className="p-datatable-sm">
                <Column field="row" header="Row" style={{ width: '80px' }} />
                <Column field="field" header="Field" style={{ width: '120px' }} />
                <Column field="message" header="Error" />
                <Column field="value" header="Value" style={{ width: '150px' }} />
              </DataTable>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button
              label="Close"
              onClick={() => setShowErrorDialog(false)}
            />
          </div>
        </Dialog>
      </div>
    </MainLayout>
  )
}
