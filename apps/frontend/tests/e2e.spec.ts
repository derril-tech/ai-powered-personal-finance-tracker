// Created automatically by Cursor AI (2025-08-28)
import { test, expect } from '@playwright/test'

test('E2E: dashboard loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Finance/i)
})
