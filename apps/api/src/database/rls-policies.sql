-- Created automatically by Cursor AI (2024-12-19)

-- Enable RLS on all multi-tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Organizations RLS Policy
CREATE POLICY "organizations_own_policy" ON organizations
    FOR ALL USING (id = current_setting('app.current_organization_id')::uuid);

-- Users RLS Policy (users can see themselves and users in their organization)
CREATE POLICY "users_own_policy" ON users
    FOR ALL USING (
        id = current_setting('app.current_user_id')::uuid OR
        organization_id = current_setting('app.current_organization_id')::uuid
    );

-- Households RLS Policy (users can see households they're members of)
CREATE POLICY "households_member_policy" ON households
    FOR ALL USING (
        id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Memberships RLS Policy (users can see memberships for households they're in)
CREATE POLICY "memberships_household_policy" ON memberships
    FOR ALL USING (
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Connections RLS Policy (users can see connections for households they're in)
CREATE POLICY "connections_household_policy" ON connections
    FOR ALL USING (
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Accounts RLS Policy (users can see accounts for households they're in)
CREATE POLICY "accounts_household_policy" ON accounts
    FOR ALL USING (
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Transactions RLS Policy (users can see transactions for accounts they have access to)
CREATE POLICY "transactions_account_policy" ON transactions
    FOR ALL USING (
        account_id IN (
            SELECT a.id 
            FROM accounts a
            JOIN memberships m ON a.household_id = m.household_id
            WHERE m.user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Merchants RLS Policy (global merchants are visible to all, user-specific merchants are restricted)
CREATE POLICY "merchants_global_policy" ON merchants
    FOR ALL USING (
        household_id IS NULL OR
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Categories RLS Policy (global categories are visible to all, user-specific categories are restricted)
CREATE POLICY "categories_global_policy" ON categories
    FOR ALL USING (
        household_id IS NULL OR
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Budgets RLS Policy (users can see budgets for households they're in)
CREATE POLICY "budgets_household_policy" ON budgets
    FOR ALL USING (
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Budget Lines RLS Policy (users can see budget lines for budgets they have access to)
CREATE POLICY "budget_lines_budget_policy" ON budget_lines
    FOR ALL USING (
        budget_id IN (
            SELECT b.id 
            FROM budgets b
            JOIN memberships m ON b.household_id = m.household_id
            WHERE m.user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Goals RLS Policy (users can see goals for households they're in)
CREATE POLICY "goals_household_policy" ON goals
    FOR ALL USING (
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Recurring RLS Policy (users can see recurring transactions for accounts they have access to)
CREATE POLICY "recurring_account_policy" ON recurring
    FOR ALL USING (
        account_id IN (
            SELECT a.id 
            FROM accounts a
            JOIN memberships m ON a.household_id = m.household_id
            WHERE m.user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Forecasts RLS Policy (users can see forecasts for households they're in)
CREATE POLICY "forecasts_household_policy" ON forecasts
    FOR ALL USING (
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Anomalies RLS Policy (users can see anomalies for transactions they have access to)
CREATE POLICY "anomalies_transaction_policy" ON anomalies
    FOR ALL USING (
        transaction_id IN (
            SELECT t.id 
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN memberships m ON a.household_id = m.household_id
            WHERE m.user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Rules RLS Policy (users can see rules for households they're in)
CREATE POLICY "rules_household_policy" ON rules
    FOR ALL USING (
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Alerts RLS Policy (users can see alerts for households they're in)
CREATE POLICY "alerts_household_policy" ON alerts
    FOR ALL USING (
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Reports RLS Policy (users can see reports for households they're in)
CREATE POLICY "reports_household_policy" ON reports
    FOR ALL USING (
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Audit Log RLS Policy (users can see audit logs for their actions and household actions)
CREATE POLICY "audit_log_user_policy" ON audit_log
    FOR ALL USING (
        user_id = current_setting('app.current_user_id')::uuid OR
        household_id IN (
            SELECT household_id 
            FROM memberships 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );

-- Function to set current user context
CREATE OR REPLACE FUNCTION set_user_context(user_id uuid, organization_id uuid)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::text, false);
    PERFORM set_config('app.current_organization_id', organization_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear user context
CREATE OR REPLACE FUNCTION clear_user_context()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', '', false);
    PERFORM set_config('app.current_organization_id', '', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to account
CREATE OR REPLACE FUNCTION user_has_account_access(account_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM accounts a
        JOIN memberships m ON a.household_id = m.household_id
        WHERE a.id = account_id AND m.user_id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to household
CREATE OR REPLACE FUNCTION user_has_household_access(household_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM memberships 
        WHERE household_id = household_id AND user_id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's household IDs
CREATE OR REPLACE FUNCTION get_user_household_ids(user_id uuid)
RETURNS uuid[] AS $$
DECLARE
    household_ids uuid[];
BEGIN
    SELECT array_agg(household_id) INTO household_ids
    FROM memberships
    WHERE user_id = user_id;
    
    RETURN COALESCE(household_ids, ARRAY[]::uuid[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's account IDs
CREATE OR REPLACE FUNCTION get_user_account_ids(user_id uuid)
RETURNS uuid[] AS $$
DECLARE
    account_ids uuid[];
BEGIN
    SELECT array_agg(a.id) INTO account_ids
    FROM accounts a
    JOIN memberships m ON a.household_id = m.household_id
    WHERE m.user_id = user_id;
    
    RETURN COALESCE(account_ids, ARRAY[]::uuid[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate user permissions for household operations
CREATE OR REPLACE FUNCTION validate_household_permission(
    household_id uuid, 
    user_id uuid, 
    required_role text DEFAULT 'member'
)
RETURNS boolean AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role
    FROM memberships
    WHERE household_id = household_id AND user_id = user_id;
    
    IF user_role IS NULL THEN
        RETURN false;
    END IF;
    
    -- Role hierarchy: owner > admin > member > viewer
    CASE required_role
        WHEN 'owner' THEN
            RETURN user_role = 'owner';
        WHEN 'admin' THEN
            RETURN user_role IN ('owner', 'admin');
        WHEN 'member' THEN
            RETURN user_role IN ('owner', 'admin', 'member');
        WHEN 'viewer' THEN
            RETURN user_role IN ('owner', 'admin', 'member', 'viewer');
        ELSE
            RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role in household
CREATE OR REPLACE FUNCTION get_user_household_role(household_id uuid, user_id uuid)
RETURNS text AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role
    FROM memberships
    WHERE household_id = household_id AND user_id = user_id;
    
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can modify household data
CREATE OR REPLACE FUNCTION can_modify_household_data(household_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN validate_household_permission(household_id, user_id, 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can view household data
CREATE OR REPLACE FUNCTION can_view_household_data(household_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN validate_household_permission(household_id, user_id, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can manage household settings
CREATE OR REPLACE FUNCTION can_manage_household_settings(household_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN validate_household_permission(household_id, user_id, 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns household
CREATE OR REPLACE FUNCTION is_household_owner(household_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN validate_household_permission(household_id, user_id, 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes to improve RLS policy performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_household_id ON memberships(household_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_household_id ON accounts(household_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_household_id ON budgets(household_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_lines_budget_id ON budget_lines(budget_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_goals_household_id ON goals(household_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_account_id ON recurring(account_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forecasts_household_id ON forecasts(household_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_anomalies_transaction_id ON anomalies(transaction_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rules_household_id ON rules(household_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_household_id ON alerts(household_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_household_id ON reports(household_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_household_id ON audit_log(household_id);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_user_context(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_account_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_household_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_household_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_account_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_household_permission(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_household_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_modify_household_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_household_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_household_settings(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_household_owner(uuid, uuid) TO authenticated;
