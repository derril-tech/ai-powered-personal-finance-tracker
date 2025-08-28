// Created automatically by Cursor AI (2025-08-28)

import { Pool } from 'pg'
import { randomUUID } from 'crypto'

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const pool = new Pool({ connectionString: databaseUrl, ssl: false })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const orgId = randomUUID()
    const ownerId = randomUUID()
    const householdId = randomUUID()

    await client.query(
      `INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [orgId, 'Demo Org']
    )

    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT DO NOTHING`,
      [ownerId, orgId, 'demo@example.com', 'Demo', 'Owner']
    )

    await client.query(
      `INSERT INTO households (id, organization_id, name, currency, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING`,
      [householdId, orgId, 'Demo Household', 'USD']
    )

    await client.query(
      `INSERT INTO memberships (household_id, user_id, role, created_at) VALUES ($1, $2, 'owner', NOW()) ON CONFLICT DO NOTHING`,
      [householdId, ownerId]
    )

    // Accounts
    const accountIds: string[] = []
    for (const name of ['Checking', 'Savings', 'Credit Card']) {
      const accountId = randomUUID()
      accountIds.push(accountId)
      await client.query(
        `INSERT INTO accounts (id, household_id, name, type, currency, balance, created_at) VALUES ($1, $2, $3, $4, 'USD', $5, NOW()) ON CONFLICT DO NOTHING`,
        [accountId, householdId, name, name === 'Credit Card' ? 'credit' : 'deposit', name === 'Savings' ? 5000 : 1500]
      )
    }

    // Categories sample
    const categories = ['Groceries', 'Rent', 'Utilities', 'Dining', 'Travel', 'Income']
    for (const cat of categories) {
      await client.query(
        `INSERT INTO categories (id, name, household_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [randomUUID(), cat, householdId]
      )
    }

    // Transactions
    const merchants = ['Amazon', 'Walmart', 'Whole Foods', 'Shell', 'Netflix', 'Delta']
    const now = new Date()
    for (let i = 0; i < 200; i++) {
      const id = randomUUID()
      const ts = new Date(now.getTime() - i * 86400000)
      const accountId = accountIds[Math.floor(Math.random() * accountIds.length)]
      const amount = parseFloat(rand(-250, 250).toFixed(2))
      const merchant = merchants[Math.floor(Math.random() * merchants.length)]
      await client.query(
        `INSERT INTO transactions (id, account_id, ts, amount, merchant_raw, description) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [id, accountId, ts, amount, merchant, `${merchant} purchase`]
      )
    }

    // Budget
    const budgetId = randomUUID()
    await client.query(
      `INSERT INTO budgets (id, household_id, name, period, start_date, currency, created_at) VALUES ($1, $2, 'Demo Budget', 'monthly', DATE_TRUNC('month', NOW()), 'USD', NOW()) ON CONFLICT DO NOTHING`,
      [budgetId, householdId]
    )

    // Goals
    await client.query(
      `INSERT INTO goals (id, household_id, name, target_amount, target_date, created_at) VALUES ($1, $2, 'Emergency Fund', 10000, NOW() + INTERVAL '180 days', NOW()) ON CONFLICT DO NOTHING`,
      [randomUUID(), householdId]
    )

    // Reports placeholder
    await client.query(
      `INSERT INTO reports (id, household_id, month, status, created_at) VALUES ($1, $2, TO_CHAR(NOW(), 'YYYY-MM'), 'ready', NOW()) ON CONFLICT DO NOTHING`,
      [randomUUID(), householdId]
    )

    await client.query('COMMIT')
    console.log('Demo data seeded successfully.')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    process.exitCode = 1
  } finally {
    client.release()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
