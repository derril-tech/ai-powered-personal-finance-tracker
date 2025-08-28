// Created automatically by Cursor AI (2025-08-28)
export const locales = ['en', 'es', 'fr'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'en'

export const messages: Record<string, Record<string, string>> = {
  en: { 'billing.title': 'Billing & Usage' },
  es: { 'billing.title': 'Facturación y Uso' },
  fr: { 'billing.title': 'Facturation et Utilisation' },
}
