// Created automatically by Cursor AI (2024-08-27)

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialTables1700000000000 implements MigrationInterface {
  name = 'CreateInitialTables1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "timescaledb"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);

    // Create organizations table
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
      )
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create households table
    await queryRunner.query(`
      CREATE TABLE "households" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "organizationId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_households" PRIMARY KEY ("id")
      )
    `);

    // Create memberships table
    await queryRunner.query(`
      CREATE TABLE "memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "householdId" uuid NOT NULL,
        "role" character varying NOT NULL DEFAULT 'member',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_memberships" PRIMARY KEY ("id")
      )
    `);

    // Create accounts table
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "householdId" uuid NOT NULL,
        "connectionId" uuid NOT NULL,
        "externalId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "type" character varying NOT NULL DEFAULT 'checking',
        "balance" decimal(15,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id")
      )
    `);

    // Create merchants table
    await queryRunner.query(`
      CREATE TABLE "merchants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "website" character varying,
        "country" character varying(2),
        "mcc" character varying,
        "embedding" vector(384),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_merchants" PRIMARY KEY ("id")
      )
    `);

    // Create categories table
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "parentId" uuid,
        "color" character varying NOT NULL,
        "icon" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id")
      )
    `);

    // Create transactions table (TimescaleDB hypertable)
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "accountId" uuid NOT NULL,
        "externalId" character varying NOT NULL,
        "amount" decimal(15,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "description" character varying NOT NULL,
        "merchantName" character varying,
        "merchantId" uuid,
        "categoryId" uuid,
        "tags" text,
        "date" TIMESTAMP NOT NULL,
        "isTransfer" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )
    `);

    // Convert transactions to TimescaleDB hypertable
    await queryRunner.query(`
      SELECT create_hypertable('transactions', 'date', if_not_exists => TRUE)
    `);

    // Create budgets table
    await queryRunner.query(`
      CREATE TABLE "budgets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "householdId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "period" character varying NOT NULL DEFAULT 'monthly',
        "startDate" TIMESTAMP NOT NULL,
        "buffer" decimal(15,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budgets" PRIMARY KEY ("id")
      )
    `);

    // Create budget_lines table
    await queryRunner.query(`
      CREATE TABLE "budget_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "budgetId" uuid NOT NULL,
        "categoryId" uuid NOT NULL,
        "amount" decimal(15,2) NOT NULL,
        "rollover" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budget_lines" PRIMARY KEY ("id")
      )
    `);

    // Create goals table
    await queryRunner.query(`
      CREATE TABLE "goals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "householdId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "targetAmount" decimal(15,2) NOT NULL,
        "targetDate" TIMESTAMP NOT NULL,
        "accountId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_goals" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "households" ADD CONSTRAINT "FK_households_organization" 
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "memberships" ADD CONSTRAINT "FK_memberships_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "memberships" ADD CONSTRAINT "FK_memberships_household" 
      FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "accounts" ADD CONSTRAINT "FK_accounts_household" 
      FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_parent" 
      FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_account" 
      FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_merchant" 
      FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_category" 
      FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "budgets" ADD CONSTRAINT "FK_budgets_household" 
      FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "budget_lines" ADD CONSTRAINT "FK_budget_lines_budget" 
      FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "budget_lines" ADD CONSTRAINT "FK_budget_lines_category" 
      FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "goals" ADD CONSTRAINT "FK_goals_household" 
      FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "goals" ADD CONSTRAINT "FK_goals_account" 
      FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_date" ON "transactions" ("date")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_account" ON "transactions" ("accountId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_merchant" ON "transactions" ("merchantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_category" ON "transactions" ("categoryId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_merchants_embedding" ON "merchants" USING ivfflat (embedding vector_cosine_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "goals"`);
    await queryRunner.query(`DROP TABLE "budget_lines"`);
    await queryRunner.query(`DROP TABLE "budgets"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "merchants"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TABLE "memberships"`);
    await queryRunner.query(`DROP TABLE "households"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}
