// Created automatically by Cursor AI (2024-12-19)

import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateContinuousAggregates1703000000000 implements MigrationInterface {
  name = 'CreateContinuousAggregates1703000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create continuous aggregate for daily totals by category
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW daily_category_totals
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 day', date) AS bucket,
        household_id,
        category_id,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE is_excluded = false
      GROUP BY bucket, household_id, category_id
      WITH NO DATA;
    `)

    // Create continuous aggregate for daily totals by account
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW daily_account_totals
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 day', date) AS bucket,
        household_id,
        account_id,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE is_excluded = false
      GROUP BY bucket, household_id, account_id
      WITH NO DATA;
    `)

    // Create continuous aggregate for daily totals by household
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW daily_household_totals
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 day', date) AS bucket,
        household_id,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE is_excluded = false
      GROUP BY bucket, household_id
      WITH NO DATA;
    `)

    // Create continuous aggregate for monthly totals by category
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW monthly_category_totals
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 month', date) AS bucket,
        household_id,
        category_id,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE is_excluded = false
      GROUP BY bucket, household_id, category_id
      WITH NO DATA;
    `)

    // Create continuous aggregate for monthly totals by account
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW monthly_account_totals
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 month', date) AS bucket,
        household_id,
        account_id,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE is_excluded = false
      GROUP BY bucket, household_id, account_id
      WITH NO DATA;
    `)

    // Create continuous aggregate for monthly totals by household
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW monthly_household_totals
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 month', date) AS bucket,
        household_id,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE is_excluded = false
      GROUP BY bucket, household_id
      WITH NO DATA;
    `)

    // Create continuous aggregate for merchant spending patterns
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW daily_merchant_totals
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 day', date) AS bucket,
        household_id,
        merchant_id,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE is_excluded = false AND amount < 0
      GROUP BY bucket, household_id, merchant_id
      WITH NO DATA;
    `)

    // Create continuous aggregate for recurring transaction detection
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW recurring_patterns
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 day', date) AS bucket,
        household_id,
        merchant_id,
        category_id,
        amount,
        COUNT(*) as frequency,
        AVG(EXTRACT(EPOCH FROM (date - LAG(date) OVER (PARTITION BY household_id, merchant_id, category_id, amount ORDER BY date)))) as avg_interval_days
      FROM transactions
      WHERE is_excluded = false
      GROUP BY bucket, household_id, merchant_id, category_id, amount
      HAVING COUNT(*) >= 2
      WITH NO DATA;
    `)

    // Add refresh policies for the continuous aggregates
    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('daily_category_totals',
        start_offset => INTERVAL '3 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour');
    `)

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('daily_account_totals',
        start_offset => INTERVAL '3 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour');
    `)

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('daily_household_totals',
        start_offset => INTERVAL '3 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour');
    `)

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('monthly_category_totals',
        start_offset => INTERVAL '3 months',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 day');
    `)

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('monthly_account_totals',
        start_offset => INTERVAL '3 months',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 day');
    `)

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('monthly_household_totals',
        start_offset => INTERVAL '3 months',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 day');
    `)

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('daily_merchant_totals',
        start_offset => INTERVAL '3 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour');
    `)

    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy('recurring_patterns',
        start_offset => INTERVAL '30 days',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 day');
    `)

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX idx_daily_category_totals_household_bucket 
      ON daily_category_totals (household_id, bucket DESC);
    `)

    await queryRunner.query(`
      CREATE INDEX idx_daily_account_totals_household_bucket 
      ON daily_account_totals (household_id, bucket DESC);
    `)

    await queryRunner.query(`
      CREATE INDEX idx_daily_household_totals_household_bucket 
      ON daily_household_totals (household_id, bucket DESC);
    `)

    await queryRunner.query(`
      CREATE INDEX idx_monthly_category_totals_household_bucket 
      ON monthly_category_totals (household_id, bucket DESC);
    `)

    await queryRunner.query(`
      CREATE INDEX idx_monthly_account_totals_household_bucket 
      ON monthly_account_totals (household_id, bucket DESC);
    `)

    await queryRunner.query(`
      CREATE INDEX idx_monthly_household_totals_household_bucket 
      ON monthly_household_totals (household_id, bucket DESC);
    `)

    await queryRunner.query(`
      CREATE INDEX idx_daily_merchant_totals_household_bucket 
      ON daily_merchant_totals (household_id, bucket DESC);
    `)

    await queryRunner.query(`
      CREATE INDEX idx_recurring_patterns_household_bucket 
      ON recurring_patterns (household_id, bucket DESC);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop continuous aggregates in reverse order
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS recurring_patterns CASCADE;`)
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS daily_merchant_totals CASCADE;`)
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS monthly_household_totals CASCADE;`)
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS monthly_account_totals CASCADE;`)
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS monthly_category_totals CASCADE;`)
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS daily_household_totals CASCADE;`)
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS daily_account_totals CASCADE;`)
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS daily_category_totals CASCADE;`)
  }
}
