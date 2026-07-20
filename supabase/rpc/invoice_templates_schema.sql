-- Script SQL para crear la tabla de plantillas de factura
-- Ejecutar en Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS invoice_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    logo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#1e3a5f',
    secondary_color VARCHAR(20) DEFAULT '#2563eb',
    accent_color VARCHAR(20) DEFAULT '#10b981',
    company_name VARCHAR(200) NOT NULL DEFAULT 'Mi Empresa S.A.S.',
    company_nit VARCHAR(50),
    company_address TEXT,
    company_phone VARCHAR(50),
    company_email VARCHAR(100),
    company_website VARCHAR(200),
    footer_text TEXT,
    payment_terms TEXT,
    bank_info TEXT,
    show_logo BOOLEAN DEFAULT true,
    show_qr BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar plantilla por defecto
INSERT INTO invoice_templates (
    name, is_default, primary_color, secondary_color, accent_color,
    company_name, company_nit, company_address, company_phone, company_email,
    footer_text, payment_terms, show_logo
) VALUES (
    'Plantilla Estándar', true, '#1e3a5f', '#2563eb', '#10b981',
    'DigiKawsay S.A.S.', '900.123.456-7', 'Calle 123 # 45-67, Bogotá D.C.',
    '+57 1 234 5678', 'contacto@digikawsay.app',
    'Gracias por su preferencia', 'Pago a 30 días', true
) ON CONFLICT DO NOTHING;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_invoice_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoice_templates_updated_at ON invoice_templates;
CREATE TRIGGER update_invoice_templates_updated_at
    BEFORE UPDATE ON invoice_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_templates_updated_at();

-- Índice
CREATE INDEX IF NOT EXISTS idx_invoice_templates_default ON invoice_templates(is_default);
