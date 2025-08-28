// Created automatically by Cursor AI (2024-12-19)

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PrimeReactProvider } from 'primereact/api'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AuthProvider } from '@/components/providers/auth-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Finance Tracker',
  description: 'AI-powered personal finance tracking application',
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <PrimeReactProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <AuthProvider>
                {children}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: 'var(--surface-card)',
                      color: 'var(--text-color)',
                      border: '1px solid var(--surface-border)',
                    },
                  }}
                />
              </AuthProvider>
            </ThemeProvider>
          </PrimeReactProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
