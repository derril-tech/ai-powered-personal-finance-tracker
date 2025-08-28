// Created automatically by Cursor AI (2024-12-19)

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from 'primereact/sidebar'
import { Button } from 'primereact/button'
import { Menu } from 'primereact/menu'
import { MenuItem } from 'primereact/menuitem'
import { useAuth } from '@/components/providers/auth-provider'
import { useTheme } from '@/components/providers/theme-provider'
import { 
  PiHouse, 
  PiCreditCard, 
  PiReceipt, 
  PiTag, 
  PiWallet, 
  PiTarget, 
  PiChartLine, 
  PiWarning, 
  PiFileText, 
  PiDownload, 
  PiGear,
  PiSun,
  PiMoon,
  PiMonitor,
  PiSignOut
} from 'react-icons/pi'

export function SidebarComponent() {
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  const menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: <PiHouse className="w-5 h-5" />,
      url: '/dashboard',
      className: pathname === '/dashboard' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Accounts',
      icon: <PiCreditCard className="w-5 h-5" />,
      url: '/accounts',
      className: pathname === '/accounts' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Transactions',
      icon: <PiReceipt className="w-5 h-5" />,
      url: '/transactions',
      className: pathname === '/transactions' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Categories',
      icon: <PiTag className="w-5 h-5" />,
      url: '/categories',
      className: pathname === '/categories' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Budgets',
      icon: <PiWallet className="w-5 h-5" />,
      url: '/budgets',
      className: pathname === '/budgets' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Goals',
      icon: <PiTarget className="w-5 h-5" />,
      url: '/goals',
      className: pathname === '/goals' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Forecasts',
      icon: <PiChartLine className="w-5 h-5" />,
      url: '/forecasts',
      className: pathname === '/forecasts' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Anomalies',
      icon: <PiWarning className="w-5 h-5" />,
      url: '/anomalies',
      className: pathname === '/anomalies' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Reports',
      icon: <PiFileText className="w-5 h-5" />,
      url: '/reports',
      className: pathname === '/reports' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Exports',
      icon: <PiDownload className="w-5 h-5" />,
      url: '/exports',
      className: pathname === '/exports' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
    {
      label: 'Settings',
      icon: <PiGear className="w-5 h-5" />,
      url: '/settings',
      className: pathname === '/settings' ? 'bg-primary-50 dark:bg-primary-900' : '',
    },
  ]

  const themeItems: MenuItem[] = [
    {
      label: 'Light',
      icon: <PiSun className="w-4 h-4" />,
      command: () => setTheme('light'),
    },
    {
      label: 'Dark',
      icon: <PiMoon className="w-4 h-4" />,
      command: () => setTheme('dark'),
    },
    {
      label: 'System',
      icon: <PiMonitor className="w-4 h-4" />,
      command: () => setTheme('system'),
    },
  ]

  const userItems: MenuItem[] = [
    {
      label: user?.firstName + ' ' + user?.lastName,
      disabled: true,
      className: 'font-semibold',
    },
    {
      separator: true,
    },
    {
      label: 'Theme',
      items: themeItems,
    },
    {
      separator: true,
    },
    {
      label: 'Sign Out',
      icon: <PiSignOut className="w-4 h-4" />,
      command: logout,
    },
  ]

  return (
    <>
      {/* Mobile menu button */}
      <Button
        icon="pi pi-bars"
        onClick={() => setVisible(true)}
        className="lg:hidden p-button-text"
      />

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-50 lg:bg-white lg:border-r lg:border-gray-200 dark:lg:bg-gray-800 dark:lg:border-gray-700">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Finance Tracker
            </h1>
          </div>

          {/* Navigation */}
          <nav className="mt-8 flex-1 px-2 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.url}
                href={item.url!}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  pathname === item.url
                    ? 'bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100'
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User menu */}
          <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
            <Menu model={userItems} popup />
            <Button
              label={user?.firstName + ' ' + user?.lastName}
              icon="pi pi-user"
              className="p-button-text w-full justify-start"
              onClick={(e) => {
                const menu = document.querySelector('.p-menu') as any
                if (menu) {
                  menu.toggle(e)
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <Sidebar
        visible={visible}
        position="left"
        onHide={() => setVisible(false)}
        className="w-64"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-4 py-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Finance Tracker
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.url}
                href={item.url!}
                onClick={() => setVisible(false)}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  pathname === item.url
                    ? 'bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100'
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User menu */}
          <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
            <Menu model={userItems} popup />
            <Button
              label={user?.firstName + ' ' + user?.lastName}
              icon="pi pi-user"
              className="p-button-text w-full justify-start"
              onClick={(e) => {
                const menu = document.querySelector('.p-menu') as any
                if (menu) {
                  menu.toggle(e)
                }
              }}
            />
          </div>
        </div>
      </Sidebar>
    </>
  )
}
