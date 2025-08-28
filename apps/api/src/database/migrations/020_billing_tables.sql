-- Created automatically by Cursor AI (2024-12-19)

-- Billing and usage tracking tables

-- Organizations billing info
CREATE TABLE organization_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    billing_email VARCHAR(255) NOT NULL,
    billing_address JSONB,
    tax_id VARCHAR(100),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Subscription plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    features JSONB NOT NULL DEFAULT '{}',
    limits JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization subscriptions
CREATE TABLE organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, canceled, past_due, unpaid
    billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly', -- monthly, yearly
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Add-on products
CREATE TABLE addon_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    unit_type VARCHAR(20) NOT NULL, -- seats, connections, storage_gb, api_calls
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization add-ons
CREATE TABLE organization_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES addon_products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, canceled
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, addon_id)
);

-- Usage tracking
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric_name VARCHAR(50) NOT NULL, -- active_users, api_calls, storage_gb, connections
    metric_value DECIMAL(15,2) NOT NULL,
    metric_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, metric_name, metric_date)
);

-- Usage events (for detailed tracking)
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL, -- api_call, file_upload, report_generated, etc.
    event_data JSONB,
    metric_value DECIMAL(15,2) DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, open, paid, void, uncollectible
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(invoice_number)
);

-- Invoice line items
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment methods
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- card, bank_account, paypal
    provider VARCHAR(20) NOT NULL, -- stripe, paypal, etc.
    provider_payment_method_id VARCHAR(255) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_billing_org_id ON organization_billing(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_subscriptions_org_id ON organization_subscriptions(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_addons_org_id ON organization_addons(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_org_id ON usage_metrics(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_date ON usage_metrics(metric_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_events_org_id ON usage_events(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_org_id ON invoices(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_methods_org_id ON payment_methods(organization_id);

-- Enable RLS on billing tables
ALTER TABLE organization_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS policies for billing tables
CREATE POLICY "organization_billing_own_policy" ON organization_billing
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "organization_subscriptions_own_policy" ON organization_subscriptions
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "organization_addons_own_policy" ON organization_addons
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "usage_metrics_own_policy" ON usage_metrics
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "usage_events_own_policy" ON usage_events
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "invoices_own_policy" ON invoices
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "invoice_line_items_own_policy" ON invoice_line_items
    FOR ALL USING (invoice_id IN (
        SELECT id FROM invoices WHERE organization_id = current_setting('app.current_organization_id')::uuid
    ));

CREATE POLICY "payment_methods_own_policy" ON payment_methods
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, limits) VALUES
('Free', 'Basic personal finance tracking', 0, 0, 
 '{"accounts": 2, "transactions": 1000, "budgets": 1, "reports": "monthly", "support": "community"}',
 '{"max_users": 1, "max_connections": 2, "storage_gb": 1, "api_calls_per_month": 1000}'),
('Pro', 'Advanced features for individuals and small families', 9.99, 99.99,
 '{"accounts": 10, "transactions": 10000, "budgets": 5, "reports": "unlimited", "support": "email", "forecasts": true, "anomaly_detection": true}',
 '{"max_users": 5, "max_connections": 10, "storage_gb": 10, "api_calls_per_month": 10000}'),
('Business', 'Complete solution for businesses and large households', 29.99, 299.99,
 '{"accounts": 50, "transactions": 50000, "budgets": 20, "reports": "unlimited", "support": "priority", "forecasts": true, "anomaly_detection": true, "advanced_analytics": true, "api_access": true}',
 '{"max_users": 20, "max_connections": 50, "storage_gb": 100, "api_calls_per_month": 100000}');

-- Insert default add-on products
INSERT INTO addon_products (name, description, price_monthly, price_yearly, unit_type) VALUES
('Additional Users', 'Add more users to your household', 2.99, 29.99, 'seats'),
('Additional Connections', 'Connect more bank accounts', 1.99, 19.99, 'connections'),
('Additional Storage', 'More storage for statements and reports', 0.99, 9.99, 'storage_gb'),
('API Access', 'Programmatic access to your data', 4.99, 49.99, 'api_calls'),
('Priority Support', '24/7 priority customer support', 9.99, 99.99, 'support_tier');

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organization_billing_updated_at BEFORE UPDATE ON organization_billing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_subscriptions_updated_at BEFORE UPDATE ON organization_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_addon_products_updated_at BEFORE UPDATE ON addon_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_addons_updated_at BEFORE UPDATE ON organization_addons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
