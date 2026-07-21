-- =====================================================
-- SQL para Módulo de Nómina - DigiKawsay
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Tabla de Empleados
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(10) NOT NULL CHECK (document_type IN ('CC', 'CE', 'TI', 'PA')),
    document_number VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    hire_date DATE NOT NULL,
    termination_date DATE,
    position VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    base_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
    contract_type VARCHAR(30) NOT NULL CHECK (contract_type IN ('INDEFINIDO', 'FIJO', 'OBRA_LABOR', 'PRESTACION_SERVICIOS')),
    payment_frequency VARCHAR(20) NOT NULL DEFAULT 'MENSUAL' CHECK (payment_frequency IN ('QUINCENAL', 'MENSUAL')),
    bank_name VARCHAR(100),
    bank_account_type VARCHAR(20) CHECK (bank_account_type IN ('AHORROS', 'CORRIENTE')),
    bank_account_number VARCHAR(50),
    eps VARCHAR(100),
    pension_fund VARCHAR(100),
    arl_risk_level INTEGER NOT NULL DEFAULT 1 CHECK (arl_risk_level BETWEEN 1 AND 5),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de Nóminas (headers)
CREATE TABLE IF NOT EXISTS payrolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('PRIMERA_QUINCENA', 'SEGUNDA_QUINCENA', 'MENSUAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED')),
    total_earnings DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_employer_costs DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_pay DECIMAL(15,2) NOT NULL DEFAULT 0,
    payment_date DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_year, period_month, period_type)
);

-- Tabla de Líneas de Nómina (detalle por empleado)
CREATE TABLE IF NOT EXISTS payroll_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id UUID NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id),
    base_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
    worked_days INTEGER NOT NULL DEFAULT 30,
    -- Devengados (Earnings)
    salary_earned DECIMAL(15,2) NOT NULL DEFAULT 0,
    transportation_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
    overtime_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
    overtime_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    bonuses DECIMAL(15,2) NOT NULL DEFAULT 0,
    commissions DECIMAL(15,2) NOT NULL DEFAULT 0,
    other_earnings DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_earnings DECIMAL(15,2) NOT NULL DEFAULT 0,
    -- Deducciones empleado
    health_employee DECIMAL(15,2) NOT NULL DEFAULT 0,
    pension_employee DECIMAL(15,2) NOT NULL DEFAULT 0,
    solidarity_fund DECIMAL(15,2) NOT NULL DEFAULT 0,
    retention_source DECIMAL(15,2) NOT NULL DEFAULT 0,
    other_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
    -- Aportes empleador
    health_employer DECIMAL(15,2) NOT NULL DEFAULT 0,
    pension_employer DECIMAL(15,2) NOT NULL DEFAULT 0,
    arl DECIMAL(15,2) NOT NULL DEFAULT 0,
    sena DECIMAL(15,2) NOT NULL DEFAULT 0,
    icbf DECIMAL(15,2) NOT NULL DEFAULT 0,
    caja_compensacion DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_employer_costs DECIMAL(15,2) NOT NULL DEFAULT 0,
    -- Neto
    net_pay DECIMAL(15,2) NOT NULL DEFAULT 0,
    UNIQUE(payroll_id, employee_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_employees_document ON employees(document_number);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_payrolls_period ON payrolls(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payrolls_status ON payrolls(status);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_payroll ON payroll_lines(payroll_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_employee ON payroll_lines(employee_id);

-- RLS Policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios autenticados
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated USING (true);
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated USING (true);

CREATE POLICY "payrolls_select" ON payrolls FOR SELECT TO authenticated USING (true);
CREATE POLICY "payrolls_insert" ON payrolls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payrolls_update" ON payrolls FOR UPDATE TO authenticated USING (true);
CREATE POLICY "payrolls_delete" ON payrolls FOR DELETE TO authenticated USING (true);

CREATE POLICY "payroll_lines_select" ON payroll_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_lines_insert" ON payroll_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payroll_lines_update" ON payroll_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "payroll_lines_delete" ON payroll_lines FOR DELETE TO authenticated USING (true);

-- =====================================================
-- SQL para Facturación Electrónica DIAN (Estructura)
-- =====================================================

-- Tabla de Configuración DIAN
CREATE TABLE IF NOT EXISTS dian_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nit VARCHAR(20) NOT NULL,
    dv VARCHAR(1),
    business_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    economic_activity_code VARCHAR(10),
    tax_regime VARCHAR(30) CHECK (tax_regime IN ('RESPONSABLE_IVA', 'NO_RESPONSABLE_IVA', 'REGIMEN_SIMPLE')),
    address TEXT,
    city_code VARCHAR(10),
    city_name VARCHAR(100),
    department_code VARCHAR(10),
    department_name VARCHAR(100),
    country_code VARCHAR(5) DEFAULT 'CO',
    postal_code VARCHAR(20),
    email VARCHAR(255),
    phone VARCHAR(50),
    software_id VARCHAR(100),
    software_pin VARCHAR(100),
    test_set_id VARCHAR(100),
    environment VARCHAR(20) DEFAULT 'TEST' CHECK (environment IN ('TEST', 'PRODUCTION')),
    certificate_path TEXT,
    certificate_password TEXT,
    is_configured BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de Resoluciones DIAN
CREATE TABLE IF NOT EXISTS dian_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resolution_number VARCHAR(50) NOT NULL,
    resolution_date DATE NOT NULL,
    prefix VARCHAR(10) NOT NULL,
    range_from INTEGER NOT NULL,
    range_to INTEGER NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    technical_key VARCHAR(255),
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    invoice_type VARCHAR(20) NOT NULL DEFAULT 'VENTA' CHECK (invoice_type IN ('VENTA', 'NOTA_CREDITO', 'NOTA_DEBITO')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de Facturas Electrónicas
CREATE TABLE IF NOT EXISTS electronic_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    dian_resolution_number VARCHAR(50),
    dian_resolution_date DATE,
    dian_prefix VARCHAR(10),
    dian_range_from INTEGER,
    dian_range_to INTEGER,
    dian_technical_key VARCHAR(255),
    cufe VARCHAR(255),
    qr_code TEXT,
    xml_content TEXT,
    xml_signed TEXT,
    pdf_url TEXT,
    dian_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (dian_status IN ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'ERROR')),
    dian_response_code VARCHAR(50),
    dian_response_message TEXT,
    dian_validation_date TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejection_reason TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(invoice_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dian_resolutions_active ON dian_resolutions(is_active, valid_until);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_status ON electronic_invoices(dian_status);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_invoice ON electronic_invoices(invoice_id);

-- RLS Policies para DIAN
ALTER TABLE dian_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dian_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE electronic_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dian_config_select" ON dian_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "dian_config_insert" ON dian_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dian_config_update" ON dian_config FOR UPDATE TO authenticated USING (true);

CREATE POLICY "dian_resolutions_select" ON dian_resolutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dian_resolutions_insert" ON dian_resolutions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dian_resolutions_update" ON dian_resolutions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "electronic_invoices_select" ON electronic_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "electronic_invoices_insert" ON electronic_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "electronic_invoices_update" ON electronic_invoices FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- Agregar permisos para módulo Nómina al rol Admin
-- =====================================================
INSERT INTO role_permissions (role_id, module, can_read, can_write, can_delete, can_approve)
SELECT 
    ur.id,
    'nomina',
    true,
    true,
    true,
    true
FROM user_roles ur
WHERE ur.name = 'Administrador'
ON CONFLICT DO NOTHING;
