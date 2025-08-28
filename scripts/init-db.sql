-- Created automatically by Cursor AI (2024-08-27)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create roles for RLS
CREATE ROLE finance_tracker_app;
CREATE ROLE finance_tracker_readonly;

-- Grant permissions
GRANT CONNECT ON DATABASE finance_tracker TO finance_tracker_app;
GRANT CONNECT ON DATABASE finance_tracker TO finance_tracker_readonly;

-- Set up RLS template
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO finance_tracker_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO finance_tracker_readonly;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS ml;

-- Grant schema permissions
GRANT USAGE ON SCHEMA auth TO finance_tracker_app;
GRANT USAGE ON SCHEMA finance TO finance_tracker_app;
GRANT USAGE ON SCHEMA ml TO finance_tracker_app;

GRANT USAGE ON SCHEMA auth TO finance_tracker_readonly;
GRANT USAGE ON SCHEMA finance TO finance_tracker_readonly;
GRANT USAGE ON SCHEMA ml TO finance_tracker_readonly;
