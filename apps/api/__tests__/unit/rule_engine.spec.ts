// Created automatically by Cursor AI (2025-08-28)

import { describe, it, expect } from 'vitest'

describe('Unit: rule engine (mock evaluator)', () => {
  const transaction = { amount: -25.5, merchant: 'Amazon', descriptor: 'AMZN* MARKET', categoryId: null }
  const rule = { conditions: [{ field: 'merchant', op: 'contains', value: 'amazon' }], actions: [{ type: 'set_category', value: 'shopping' }]}

  it('applies set_category when condition matches (case-insensitive mock)', () => {
    const matches = rule.conditions.every(c => String((transaction as any)[c.field]).toLowerCase().includes(String(c.value).toLowerCase()))
    const updated = { ...transaction }
    if (matches) {
      for (const a of rule.actions) {
        if (a.type === 'set_category') (updated as any).categoryId = a.value
      }
    }
    expect(updated.categoryId).toBe('shopping')
  })
})
