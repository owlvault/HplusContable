-- =====================================================================
-- FASE 6 — MIGRACIÓN DE RESILIENCIA EMPRESARIAL Y OUTBOX PATTERN
-- =====================================================================

-- 1. CONFIGURACIÓN TRIBUTARIA DINÁMICA (UVT ANUAL Y BASES FISCALES)
CREATE TABLE IF NOT EXISTS tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL UNIQUE,
    uvt_value_cop NUMERIC(12,2) NOT NULL,
    compras_general_uvt NUMERIC(6,2) NOT NULL DEFAULT 27.0,
    servicios_general_uvt NUMERIC(6,2) NOT NULL DEFAULT 4.0,
    gmf_exemption_monthly_uvt NUMERIC(6,2) NOT NULL DEFAULT 350.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Inserción de valores históricos UVT Colombia
INSERT INTO tax_configurations (fiscal_year, uvt_value_cop, compras_general_uvt, servicios_general_uvt, gmf_exemption_monthly_uvt)
VALUES 
    (2023, 42412.00, 27.0, 4.0, 350.0),
    (2024, 47065.00, 27.0, 4.0, 350.0),
    (2025, 49799.00, 27.0, 4.0, 350.0),
    (2026, 52800.00, 27.0, 4.0, 350.0)
ON CONFLICT (fiscal_year) DO UPDATE 
SET uvt_value_cop = EXCLUDED.uvt_value_cop;

-- 2. PATRÓN TRANSACCIONAL OUTBOX (OUTBOX EVENTS)
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    aggregate_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'CREDIT_NOTE', 'PAYROLL', 'PAYMENT', 'PAYMENT_INTENT'
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,    -- 'invoice.dian_emission_requested', 'payment.auto_reversal'
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DLQ')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    locked_by VARCHAR(100),
    locked_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_poll 
ON outbox_events(scheduled_for, created_at) 
WHERE status IN ('PENDING', 'FAILED') OR (status = 'PROCESSING' AND locked_until < clock_timestamp());

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate 
ON outbox_events(aggregate_type, aggregate_id);

-- 3. COLA DE MENSAJES MUERTOS (DEAD-LETTER QUEUE - DLQ)
CREATE TABLE IF NOT EXISTS dead_letter_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_event_id UUID REFERENCES outbox_events(id) ON DELETE CASCADE,
    organization_id UUID,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    failure_reason TEXT NOT NULL,
    stack_trace TEXT,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    replayed_at TIMESTAMPTZ,
    replayed_by UUID,
    resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_dlq_failed_at ON dead_letter_events(failed_at DESC);

-- 4. IDEMPOTENCIA EMPRESARIAL
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(128) NOT NULL,
    organization_id UUID,
    user_id UUID,
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
    response_code INTEGER,
    response_body JSONB,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup 
ON idempotency_keys(created_at) 
WHERE created_at < NOW() - INTERVAL '48 hours';

-- 5. AUDITORÍA CRIPTOGRÁFICA INMUTABLE (MERKLE HASH CHAINING ANTI-FORKING)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    table_name VARCHAR(64) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'APPROVE', 'CANCEL', 'VOID', 'DIAN_TRANSMIT')),
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB,
    user_id UUID,
    user_ip INET,
    user_agent TEXT,
    sequence_number BIGSERIAL,
    prev_hash VARCHAR(64) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Función de auditoría con bloqueo advisory anti-forking
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prev_hash VARCHAR(64);
    v_calculated_hash VARCHAR(64);
    v_org_id UUID := NULL;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
    v_changed JSONB := NULL;
    v_action VARCHAR(16);
    v_record_id UUID;
    v_lock_key BIGINT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_record_id := NEW.id;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_record_id := NEW.id;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        SELECT jsonb_object_agg(n.key, n.value) INTO v_changed
        FROM jsonb_each(v_new) n
        WHERE v_old->n.key IS DISTINCT FROM n.value;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_record_id := OLD.id;
        v_old := to_jsonb(OLD);
    END IF;

    -- Bloqueo advisory para serializar la cadena criptográfica
    v_lock_key := hashtext('audit_chain_lock');
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Obtener último hash confirmado
    SELECT hash INTO v_prev_hash
    FROM audit_logs
    ORDER BY sequence_number DESC
    LIMIT 1;

    IF v_prev_hash IS NULL THEN
        v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    -- Computar SHA-256 Hash Chain
    v_calculated_hash := encode(
        digest(
            v_prev_hash || '|' || 
            TG_TABLE_NAME || '|' || 
            v_record_id::text || '|' || 
            v_action || '|' || 
            COALESCE(v_old::text, '') || '|' || 
            COALESCE(v_new::text, '') || '|' || 
            COALESCE(auth.uid()::text, 'system') || '|' || 
            clock_timestamp()::text,
            'sha256'
        ), 
        'hex'
    );

    INSERT INTO audit_logs (
        table_name, record_id, action,
        old_data, new_data, changed_fields, user_id,
        prev_hash, hash, created_at
    ) VALUES (
        TG_TABLE_NAME, v_record_id, v_action,
        v_old, v_new, v_changed, auth.uid(),
        v_prev_hash, v_calculated_hash, clock_timestamp()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6. ASIGNACIÓN ATÓMICA DE CONSECUTIVOS DIAN CON TIMEZONE COLOMBIA
CREATE OR REPLACE FUNCTION get_next_invoice_number_secure(
    p_prefix VARCHAR(10) DEFAULT ''
)
RETURNS TABLE (
    assigned_number INTEGER,
    resolution_id UUID,
    is_exhausted BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_res RECORD;
    v_next INTEGER;
    v_clean_prefix VARCHAR(10);
BEGIN
    v_clean_prefix := COALESCE(p_prefix, '');

    -- Bloqueo pesimista exclusivo evaluando fecha legal en Zona Horaria de Colombia
    SELECT id, range_from, range_to, current_number, valid_until
    INTO v_res
    FROM dian_resolutions
    WHERE COALESCE(prefix, '') = v_clean_prefix
      AND is_active = true
      AND valid_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe una resolución DIAN activa y vigente para el prefijo "%"', v_clean_prefix
            USING ERRCODE = 'P0002';
    END IF;

    -- Calcular siguiente consecutivo
    IF v_res.current_number IS NULL OR v_res.current_number < v_res.range_from THEN
        v_next := v_res.range_from;
    ELSE
        v_next := v_res.current_number + 1;
    END IF;

    -- Validar límite autorizado
    IF v_next > v_res.range_to THEN
        RAISE EXCEPTION 'Rango de facturación agotado para el prefijo "%". Máximo autorizado: %, Intento: %',
            v_clean_prefix, v_res.range_to, v_next
            USING ERRCODE = 'P0003';
    END IF;

    -- Actualizar contador atómicamente
    UPDATE dian_resolutions
    SET current_number = v_next,
        updated_at = clock_timestamp()
    WHERE id = v_res.id;

    RETURN QUERY SELECT v_next, v_res.id, (v_next = v_res.range_to);
END;
$$;

-- 7. ARRIENDO DE RANGOS DE CONSECUTIVOS PARA POS OFFLINE
CREATE TABLE IF NOT EXISTS pos_consecutive_leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resolution_id UUID,
    pos_terminal_id VARCHAR(50) NOT NULL,
    prefix VARCHAR(10) NOT NULL DEFAULT '',
    leased_from INTEGER NOT NULL,
    leased_to INTEGER NOT NULL,
    current_leased_number INTEGER NOT NULL,
    is_exhausted BOOLEAN NOT NULL DEFAULT false,
    leased_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(pos_terminal_id, prefix, leased_from, leased_to)
);

CREATE INDEX IF NOT EXISTS idx_pos_leases_active 
ON pos_consecutive_leases(pos_terminal_id, is_exhausted, expires_at);

-- 8. MATRIZ DE NOTAS CRÉDITO Y REVERSO DE KARDEX CON COSTO CONGELADO
CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
    prefix VARCHAR(10) NOT NULL DEFAULT '',
    number INTEGER NOT NULL,
    dian_concept_code VARCHAR(5) NOT NULL CHECK (dian_concept_code IN ('1', '2', '3', '4', '5')),
    date TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    third_party_id UUID REFERENCES third_parties(id) ON DELETE RESTRICT,
    
    subtotal NUMERIC(20,2) NOT NULL DEFAULT 0,
    discount NUMERIC(20,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    retention_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    total NUMERIC(20,2) NOT NULL DEFAULT 0,
    
    cude VARCHAR(96),
    qr_content TEXT,
    xml_signed_url TEXT,
    dian_response JSONB,
    dian_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SENT'
        CHECK (dian_status IN ('NOT_SENT', 'ISSUED_PENDING_DIAN', 'TRANSMITTING', 'DIAN_ACCEPTED', 'DIAN_REJECTED', 'CONTINGENCY_04')),
    
    journal_entry_id UUID REFERENCES journal_entries(id),
    state VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT', 'APPROVED', 'SENT', 'VOIDED')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(prefix, number)
);

CREATE TABLE IF NOT EXISTS credit_note_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    product_id UUID,
    product_code VARCHAR(50),
    description TEXT NOT NULL,
    quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(20,2) NOT NULL DEFAULT 0,
    historical_unit_cost NUMERIC(20,2) NOT NULL DEFAULT 0, -- Costo histórico congelado para restock
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(20,2) NOT NULL DEFAULT 0,
    total NUMERIC(20,2) NOT NULL DEFAULT 0,
    restock_inventory BOOLEAN NOT NULL DEFAULT true        -- False para conceptos 3 y 4 (Descuento/Ajuste de precio)
);

-- 9. EXTENSIÓN DE COLUMNAS EN INVOICES E INVOICE_LINES
DO $$
BEGIN
    -- invoices extensions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='physical_issued_at') THEN
        ALTER TABLE invoices ADD COLUMN physical_issued_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='is_offline_sync') THEN
        ALTER TABLE invoices ADD COLUMN is_offline_sync BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='dian_retry_count') THEN
        ALTER TABLE invoices ADD COLUMN dian_retry_count INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='xml_signed_url') THEN
        ALTER TABLE invoices ADD COLUMN xml_signed_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='dian_response') THEN
        ALTER TABLE invoices ADD COLUMN dian_response JSONB;
    END IF;

    -- invoice_lines extensions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_lines' AND column_name='unit_cost') THEN
        ALTER TABLE invoice_lines ADD COLUMN unit_cost NUMERIC(20,2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_lines' AND column_name='cogs_amount') THEN
        ALTER TABLE invoice_lines ADD COLUMN cogs_amount NUMERIC(20,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- RLS
ALTER TABLE tax_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_consecutive_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_tax_config_all" ON tax_configurations;
CREATE POLICY "auth_tax_config_all" ON tax_configurations FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_outbox_events_all" ON outbox_events;
CREATE POLICY "auth_outbox_events_all" ON outbox_events FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_dead_letter_events_all" ON dead_letter_events;
CREATE POLICY "auth_dead_letter_events_all" ON dead_letter_events FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_idempotency_keys_all" ON idempotency_keys;
CREATE POLICY "auth_idempotency_keys_all" ON idempotency_keys FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_audit_logs_select" ON audit_logs;
CREATE POLICY "auth_audit_logs_select" ON audit_logs FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_pos_leases_all" ON pos_consecutive_leases;
CREATE POLICY "auth_pos_leases_all" ON pos_consecutive_leases FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_credit_notes_all" ON credit_notes;
CREATE POLICY "auth_credit_notes_all" ON credit_notes FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_credit_note_lines_all" ON credit_note_lines;
CREATE POLICY "auth_credit_note_lines_all" ON credit_note_lines FOR ALL USING (auth.role() = 'authenticated');
