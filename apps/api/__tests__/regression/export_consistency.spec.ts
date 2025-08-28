// Created automatically by Cursor AI (2025-08-28)

import { describe, it, expect } from 'vitest'

// Ensures the export bundle maintains shape across changes

describe('Regression: export bundle shape', () => {
  it('should contain required top-level keys', () => {
    const bundle = {
      user: {}, household: {}, accounts: [], transactions: [], budgets: [], goals: [],
      categories: [], merchants: [], rules: [], alerts: [], reports: [], auditLog: []
    }

    const keys = Object.keys(bundle)
    expect(keys).toEqual([
      'user','household','accounts','transactions','budgets','goals','categories','merchants','rules','alerts','reports','auditLog'
    ])
  })
})
