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
import { TabView, TabPanel } from 'primereact/tabview'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Badge } from 'primereact/badge'
import { Switch } from 'primereact/switch'
import { Calendar } from 'primereact/calendar'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/layout/main-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { 
  PiUser, 
  PiHouse, 
  PiBuilding, 
  PiBell,
  PiKey,
  PiGear,
  PiTrash,
  PiPlus,
  PiEye,
  PiEyeSlash,
  PiCopy,
  PiDownload,
  PiUpload,
  PiShield,
  PiCreditCard,
  PiEnvelope,
  PiPhone,
  PiGlobe,
  PiMapPin,
  PiCalendar,
  PiLock,
  PiUnlock
} from 'react-icons/pi'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  avatar?: string
  timezone: string
  language: string
  createdAt: Date
  updatedAt: Date
}

interface Household {
  id: string
  name: string
  description?: string
  currency: string
  timezone: string
  members: Array<{
    id: string
    email: string
    firstName: string
    lastName: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
    joinedAt: Date
  }>
}

interface Organization {
  id: string
  name: string
  description?: string
  website?: string
  address?: string
  phone?: string
  email?: string
  plan: 'free' | 'pro' | 'enterprise'
  members: Array<{
    id: string
    email: string
    firstName: string
    lastName: string
    role: 'owner' | 'admin' | 'member'
    joinedAt: Date
  }>
}

interface NotificationSettings {
  email: {
    transactions: boolean
    budgets: boolean
    bills: boolean
    anomalies: boolean
    reports: boolean
  }
  push: {
    transactions: boolean
    budgets: boolean
    bills: boolean
    anomalies: boolean
    reports: boolean
  }
  frequency: 'immediate' | 'daily' | 'weekly'
}

interface Integration {
  id: string
  name: string
  type: 'bank' | 'accounting' | 'crm' | 'other'
  status: 'active' | 'inactive' | 'error'
  lastSyncAt?: Date
  config: any
}

interface ApiKey {
  id: string
  name: string
  key: string
  permissions: string[]
  lastUsedAt?: Date
  expiresAt?: Date
  isActive: boolean
  createdAt: Date
}

const TIMEZONES = [
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Chicago', value: 'America/Chicago' },
  { label: 'America/Denver', value: 'America/Denver' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Paris', value: 'Europe/Paris' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
]

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Japanese', value: 'ja' },
]

const CURRENCIES = [
  { label: 'USD - US Dollar', value: 'USD' },
  { label: 'EUR - Euro', value: 'EUR' },
  { label: 'GBP - British Pound', value: 'GBP' },
  { label: 'JPY - Japanese Yen', value: 'JPY' },
  { label: 'CAD - Canadian Dollar', value: 'CAD' },
]

const NOTIFICATION_FREQUENCIES = [
  { label: 'Immediate', value: 'immediate' },
  { label: 'Daily Digest', value: 'daily' },
  { label: 'Weekly Summary', value: 'weekly' },
]

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const toast = useRef<Toast>(null)
  
  // State
  const [activeTab, setActiveTab] = useState(0)
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [newApiKeyName, setNewApiKeyName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [showApiKey, setShowApiKey] = useState<string | null>(null)

  // Fetch data
  const { data: userData, isLoading: userLoading } = useQuery<User>(
    'user',
    () => api.get('/users/profile').then(res => res.data)
  )

  const { data: household, isLoading: householdLoading } = useQuery<Household>(
    'household',
    () => api.get('/households/current').then(res => res.data)
  )

  const { data: organization, isLoading: orgLoading } = useQuery<Organization>(
    'organization',
    () => api.get('/organizations/current').then(res => res.data)
  )

  const { data: notificationSettings, isLoading: notifLoading } = useQuery<NotificationSettings>(
    'notification-settings',
    () => api.get('/users/notifications').then(res => res.data)
  )

  const { data: integrations, isLoading: integrationsLoading } = useQuery<Integration[]>(
    'integrations',
    () => api.get('/integrations').then(res => res.data)
  )

  const { data: apiKeys, isLoading: apiKeysLoading } = useQuery<ApiKey[]>(
    'api-keys',
    () => api.get('/users/api-keys').then(res => res.data)
  )

  // Mutations
  const updateProfileMutation = useMutation(
    (data: Partial<User>) => api.put('/users/profile', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Profile updated successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to update profile',
        })
      },
    }
  )

  const updateHouseholdMutation = useMutation(
    (data: Partial<Household>) => api.put('/households/current', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('household')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Household settings updated',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to update household',
        })
      },
    }
  )

  const updateNotificationsMutation = useMutation(
    (data: NotificationSettings) => api.put('/users/notifications', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notification-settings')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Notification settings updated',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to update notifications',
        })
      },
    }
  )

  const createApiKeyMutation = useMutation(
    (name: string) => api.post('/users/api-keys', { name }),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries('api-keys')
        setShowApiKey(data.data.key)
        setShowApiKeyDialog(false)
        setNewApiKeyName('')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'API key created successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to create API key',
        })
      },
    }
  )

  const deleteApiKeyMutation = useMutation(
    (keyId: string) => api.delete(`/users/api-keys/${keyId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('api-keys')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'API key deleted successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to delete API key',
        })
      },
    }
  )

  const inviteMemberMutation = useMutation(
    (data: { email: string; role: string }) => api.post('/households/current/invite', data),
    {
      onSuccess: () => {
        setShowInviteDialog(false)
        setInviteEmail('')
        setInviteRole('member')
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Invitation sent successfully',
        })
      },
      onError: (error: any) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || 'Failed to send invitation',
        })
      },
    }
  )

  const handleUpdateProfile = (field: keyof User, value: any) => {
    updateProfileMutation.mutate({ [field]: value })
  }

  const handleUpdateHousehold = (field: keyof Household, value: any) => {
    updateHouseholdMutation.mutate({ [field]: value })
  }

  const handleUpdateNotifications = (type: 'email' | 'push', category: string, value: boolean) => {
    if (!notificationSettings) return
    
    const updatedSettings = {
      ...notificationSettings,
      [type]: {
        ...notificationSettings[type],
        [category]: value,
      },
    }
    updateNotificationsMutation.mutate(updatedSettings)
  }

  const handleCreateApiKey = () => {
    if (!newApiKeyName.trim()) return
    createApiKeyMutation.mutate(newApiKeyName)
  }

  const handleDeleteApiKey = (keyId: string) => {
    if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      deleteApiKeyMutation.mutate(keyId)
    }
  }

  const handleInviteMember = () => {
    if (!inviteEmail.trim()) return
    inviteMemberMutation.mutate({ email: inviteEmail, role: inviteRole })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.current?.show({
      severity: 'success',
      summary: 'Copied',
      detail: 'Copied to clipboard',
    })
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString()
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      owner: 'danger',
      admin: 'warning',
      member: 'info',
      viewer: 'secondary',
    }
    return <Badge value={role.toUpperCase()} severity={colors[role as keyof typeof colors]} />
  }

  if (userLoading || householdLoading || orgLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <ProgressSpinner />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <Toast ref={toast} />
      
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account, household, and preferences
          </p>
        </div>

        {/* Settings Tabs */}
        <TabView activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)}>
          {/* Profile Tab */}
          <TabPanel header="Profile">
            <Card className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">First Name</label>
                  <InputText
                    value={userData?.firstName || ''}
                    onChange={(e) => handleUpdateProfile('firstName', e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="label">Last Name</label>
                  <InputText
                    value={userData?.lastName || ''}
                    onChange={(e) => handleUpdateProfile('lastName', e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="label">Email</label>
                  <InputText
                    value={userData?.email || ''}
                    disabled
                    className="w-full"
                  />
                  <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                
                <div>
                  <label className="label">Phone</label>
                  <InputText
                    value={userData?.phone || ''}
                    onChange={(e) => handleUpdateProfile('phone', e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="label">Timezone</label>
                  <Dropdown
                    value={userData?.timezone || 'UTC'}
                    options={TIMEZONES}
                    onChange={(e) => handleUpdateProfile('timezone', e.value)}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="label">Language</label>
                  <Dropdown
                    value={userData?.language || 'en'}
                    options={LANGUAGES}
                    onChange={(e) => handleUpdateProfile('language', e.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </Card>
          </TabPanel>

          {/* Household Tab */}
          <TabPanel header="Household">
            <Card className="card">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Household Name</label>
                    <InputText
                      value={household?.name || ''}
                      onChange={(e) => handleUpdateHousehold('name', e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="label">Currency</label>
                    <Dropdown
                      value={household?.currency || 'USD'}
                      options={CURRENCIES}
                      onChange={(e) => handleUpdateHousehold('currency', e.value)}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <InputTextarea
                      value={household?.description || ''}
                      onChange={(e) => handleUpdateHousehold('description', e.target.value)}
                      rows={3}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Members */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Household Members
                    </h3>
                    <Button
                      label="Invite Member"
                      icon={<PiPlus className="w-4 h-4" />}
                      onClick={() => setShowInviteDialog(true)}
                    />
                  </div>
                  
                  <DataTable value={household?.members || []} className="p-datatable-sm">
                    <Column field="firstName" header="Name" body={(rowData) => (
                      <div>
                        <p className="font-medium">{rowData.firstName} {rowData.lastName}</p>
                        <p className="text-sm text-gray-500">{rowData.email}</p>
                      </div>
                    )} />
                    <Column field="role" header="Role" body={(rowData) => getRoleBadge(rowData.role)} />
                    <Column field="joinedAt" header="Joined" body={(rowData) => formatDate(rowData.joinedAt)} />
                  </DataTable>
                </div>
              </div>
            </Card>
          </TabPanel>

          {/* Notifications Tab */}
          <TabPanel header="Notifications">
            <Card className="card">
              <div className="space-y-6">
                <div>
                  <label className="label">Notification Frequency</label>
                  <Dropdown
                    value={notificationSettings?.frequency || 'immediate'}
                    options={NOTIFICATION_FREQUENCIES}
                    onChange={(e) => updateNotificationsMutation.mutate({
                      ...notificationSettings!,
                      frequency: e.value
                    })}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Email Notifications */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Email Notifications
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(notificationSettings?.email || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </label>
                          <Switch
                            checked={value}
                            onChange={(e) => handleUpdateNotifications('email', key, e.checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Push Notifications */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Push Notifications
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(notificationSettings?.push || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </label>
                          <Switch
                            checked={value}
                            onChange={(e) => handleUpdateNotifications('push', key, e.checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabPanel>

          {/* Integrations Tab */}
          <TabPanel header="Integrations">
            <Card className="card">
              {integrationsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <ProgressSpinner />
                </div>
              ) : integrations && integrations.length > 0 ? (
                <div className="space-y-4">
                  {integrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                          <PiGear className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">
                            {integration.name}
                          </h3>
                          <p className="text-sm text-gray-500 capitalize">
                            {integration.type} • {integration.status}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {integration.lastSyncAt && (
                          <span className="text-sm text-gray-500">
                            Last sync: {formatDate(integration.lastSyncAt)}
                          </span>
                        )}
                        <Button
                          icon={<PiGear className="w-4 h-4" />}
                          size="small"
                          className="p-button-text p-button-sm"
                          tooltip="Configure"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <PiGear className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No Integrations
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Connect your accounts and services to get started.
                  </p>
                </div>
              )}
            </Card>
          </TabPanel>

          {/* API Keys Tab */}
          <TabPanel header="API Keys">
            <Card className="card">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    API Keys
                  </h3>
                  <Button
                    label="Create API Key"
                    icon={<PiPlus className="w-4 h-4" />}
                    onClick={() => setShowApiKeyDialog(true)}
                  />
                </div>

                {apiKeysLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <ProgressSpinner />
                  </div>
                ) : apiKeys && apiKeys.length > 0 ? (
                  <DataTable value={apiKeys} className="p-datatable-sm">
                    <Column field="name" header="Name" />
                    <Column field="key" header="Key" body={(rowData) => (
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm">
                          {showApiKey === rowData.id ? rowData.key : `${rowData.key.substring(0, 8)}...`}
                        </span>
                        <Button
                          icon={showApiKey === rowData.id ? <PiEyeSlash className="w-3 h-3" /> : <PiEye className="w-3 h-3" />}
                          size="small"
                          className="p-button-text p-button-sm"
                          onClick={() => setShowApiKey(showApiKey === rowData.id ? null : rowData.id)}
                        />
                        <Button
                          icon={<PiCopy className="w-3 h-3" />}
                          size="small"
                          className="p-button-text p-button-sm"
                          onClick={() => copyToClipboard(rowData.key)}
                        />
                      </div>
                    )} />
                    <Column field="lastUsedAt" header="Last Used" body={(rowData) => 
                      rowData.lastUsedAt ? formatDate(rowData.lastUsedAt) : 'Never'
                    } />
                    <Column field="isActive" header="Status" body={(rowData) => (
                      <Badge value={rowData.isActive ? 'Active' : 'Inactive'} severity={rowData.isActive ? 'success' : 'secondary'} />
                    )} />
                    <Column header="Actions" body={(rowData) => (
                      <Button
                        icon={<PiTrash className="w-3 h-3" />}
                        size="small"
                        className="p-button-text p-button-sm p-button-danger"
                        onClick={() => handleDeleteApiKey(rowData.id)}
                      />
                    )} />
                  </DataTable>
                ) : (
                  <div className="text-center py-12">
                    <PiKey className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      No API Keys
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Create an API key to integrate with external services.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </TabPanel>
        </TabView>

        {/* API Key Dialog */}
        <Dialog
          visible={showApiKeyDialog}
          onHide={() => setShowApiKeyDialog(false)}
          header="Create API Key"
          modal
          className="p-fluid"
          style={{ width: '400px' }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Key Name</label>
              <InputText
                value={newApiKeyName}
                onChange={(e) => setNewApiKeyName(e.target.value)}
                placeholder="Enter a name for this API key"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowApiKeyDialog(false)}
            />
            <Button
              label="Create"
              onClick={handleCreateApiKey}
              loading={createApiKeyMutation.isLoading}
              disabled={!newApiKeyName.trim()}
            />
          </div>
        </Dialog>

        {/* Invite Dialog */}
        <Dialog
          visible={showInviteDialog}
          onHide={() => setShowInviteDialog(false)}
          header="Invite Member"
          modal
          className="p-fluid"
          style={{ width: '400px' }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <InputText
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address"
                className="w-full"
              />
            </div>
            <div>
              <label className="label">Role</label>
              <Dropdown
                value={inviteRole}
                options={[
                  { label: 'Member', value: 'member' },
                  { label: 'Viewer', value: 'viewer' },
                ]}
                onChange={(e) => setInviteRole(e.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              label="Cancel"
              className="p-button-outlined"
              onClick={() => setShowInviteDialog(false)}
            />
            <Button
              label="Send Invitation"
              onClick={handleInviteMember}
              loading={inviteMemberMutation.isLoading}
              disabled={!inviteEmail.trim()}
            />
          </div>
        </Dialog>

        {/* Show API Key Dialog */}
        <Dialog
          visible={!!showApiKey}
          onHide={() => setShowApiKey(null)}
          header="API Key Created"
          modal
          className="p-fluid"
          style={{ width: '500px' }}
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Your API key has been created. Please copy it now as it won't be shown again.
            </p>
            <div className="flex space-x-2">
              <InputText
                value={showApiKey || ''}
                readOnly
                className="flex-1 font-mono"
              />
              <Button
                label="Copy"
                onClick={() => copyToClipboard(showApiKey || '')}
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button
              label="Close"
              onClick={() => setShowApiKey(null)}
            />
          </div>
        </Dialog>
      </div>
    </MainLayout>
  )
}
