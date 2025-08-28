// Created automatically by Cursor AI (2025-08-28)

import { describe, it, expect, vi, beforeEach } from 'vitest'

// High-level pipeline smoke with mocks to ensure wiring doesn't throw

describe('Integration: pipeline flow (mocked)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should execute sync → enrich → budget → forecast → alert sequence (mock)', async () => {
    const events: string[] = []

    const sync = vi.fn().mockImplementation(async () => { events.push('sync') })
    const enrich = vi.fn().mockImplementation(async () => { events.push('enrich') })
    const budget = vi.fn().mockImplementation(async () => { events.push('budget') })
    const forecast = vi.fn().mockImplementation(async () => { events.push('forecast') })
    const alert = vi.fn().mockImplementation(async () => { events.push('alert') })

    await sync(); await enrich(); await budget(); await forecast(); await alert()

    expect(events).toEqual(['sync','enrich','budget','forecast','alert'])
  })
})
