-- =====================================================
-- Módulo de Ventas - DigiKawsay / HplusContable
-- Ejecutar en Supabase SQL Editor
--
-- Cubre:
--   1. Catálogo comercial, listas de precio y tarifas de costo
--   2. Pipeline (oportunidades) y propuestas versionadas
--   3. Líneas de propuesta con precio y margen unitario al máximo detalle
--   4. Contratos, hitos de facturación y reconocimiento de ingreso
--   5. Dimensión transversal `projects` que atraviesa todo el ERP
--   6. Staging idempotente para la ingesta de la carpeta Comercial
--   7. Vistas de seguimiento financiero (plan vs. real, cascada de margen)
--
-- Convenciones: todos los montos en la moneda del documento (`currency`),
-- con `fx_rate` para convertir a COP (moneda funcional).
-- =====================================================

-- =====================================================
-- 0. DIMENSIÓN TRANSVERSAL: PROYECTOS / CENTROS DE COSTO
--    Es la columna vertebral que permite leer el ERP completo
--    por proyecto: ingreso, costo, nómina, caja y contabilidad.
-- =====================================================

CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    parent_id UUID REFERENCES cost_centers(id),
    -- Tipo de centro: los OPERATIVO reciben margen directo,
    -- los ESTRUCTURA se reparten como overhead a los proyectos.
    center_type VARCHAR(20) NOT NULL DEFAULT 'OPERATIVO'
        CHECK (center_type IN ('OPERATIVO', 'ESTRUCTURA', 'COMERCIAL')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    third_party_id UUID REFERENCES third_parties(id),
    cost_center_id UUID REFERENCES cost_centers(id),
    contract_id UUID, -- FK diferida a sales_contracts (se agrega más abajo)
    manager_user_id UUID REFERENCES auth.users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PLANEADO'
        CHECK (status IN ('PLANEADO', 'EN_EJECUCION', 'EN_PAUSA', 'CERRADO', 'CANCELADO')),
    start_date DATE,
    end_date DATE,
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',

    -- Línea base: se congela al ganar la propuesta y NO se toca.
    -- Toda la desviación se mide contra estos números.
    baseline_revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
    baseline_direct_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    baseline_hours DECIMAL(12,2) NOT NULL DEFAULT 0,
    baseline_margin DECIMAL(18,2) NOT NULL DEFAULT 0,

    -- Presupuesto vigente: la línea base más los cambios aprobados.
    budget_revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
    budget_direct_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    budget_hours DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- Avance reportado por el PM, insumo del reconocimiento por POC.
    percent_complete DECIMAL(5,2) NOT NULL DEFAULT 0
        CHECK (percent_complete BETWEEN 0 AND 100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(third_party_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- =====================================================
-- 1. CATÁLOGO COMERCIAL
-- =====================================================

-- Lo que HPlus vende. Un ítem es la unidad mínima con precio y costo
-- propios: una hora de un rol, un entregable a precio fijo, una licencia
-- revendida o un costo reembolsable.
CREATE TABLE IF NOT EXISTS sales_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    item_type VARCHAR(20) NOT NULL
        CHECK (item_type IN ('ROL', 'ENTREGABLE', 'LICENCIA', 'INFRA', 'SOPORTE', 'REEMBOLSABLE', 'OTRO')),
    unit VARCHAR(20) NOT NULL DEFAULT 'HORA'
        CHECK (unit IN ('HORA', 'DIA', 'SPRINT', 'MES', 'UNIDAD', 'GLOBAL')),

    -- Solo para item_type = 'ROL': permite comparar tarifas entre
    -- propuestas y contra el costo real de nómina del mismo perfil.
    role_family VARCHAR(60),
    seniority VARCHAR(20)
        CHECK (seniority IS NULL OR seniority IN ('TRAINEE', 'JUNIOR', 'SEMISENIOR', 'SENIOR', 'STAFF', 'PRINCIPAL')),

    -- Amarre contable: define en qué cuenta del PUC cae el ingreso y
    -- el costo cuando la venta se factura y se contabiliza.
    revenue_account_code TEXT REFERENCES puc_accounts(code),
    cost_account_code TEXT REFERENCES puc_accounts(code),

    default_tax_rate DECIMAL(5,2) NOT NULL DEFAULT 19,
    default_retention_type VARCHAR(30), -- HONORARIOS, SERVICIOS, COMPRAS...

    -- Un reembolsable se factura al costo: no debe contaminar el margen.
    is_passthrough BOOLEAN NOT NULL DEFAULT false,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_items_type ON sales_items(item_type, is_active);
CREATE INDEX IF NOT EXISTS idx_sales_items_role ON sales_items(role_family, seniority);

-- =====================================================
-- 2. LISTAS DE PRECIO (precio de venta con vigencia)
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    segment VARCHAR(40), -- CORPORATIVO, PYME, STARTUP, GOBIERNO, EXPORTACION
    valid_from DATE NOT NULL,
    valid_to DATE,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS sales_price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id UUID NOT NULL REFERENCES sales_price_lists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES sales_items(id) ON DELETE CASCADE,

    list_price DECIMAL(18,4) NOT NULL DEFAULT 0,
    -- Piso de negociación: por debajo de esto la propuesta requiere
    -- aprobación explícita (ver sales_proposals.requires_approval).
    floor_price DECIMAL(18,4),
    -- Descuento máximo que un comercial puede dar sin escalamiento.
    max_discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(price_list_id, item_id),
    CHECK (floor_price IS NULL OR floor_price <= list_price)
);

CREATE INDEX IF NOT EXISTS idx_price_list_items_item ON sales_price_list_items(item_id);

-- =====================================================
-- 3. TARIFAS DE COSTO (la otra mitad del margen unitario)
--    Sin esto el margen es una opinión. Aquí se construye el
--    costo hora cargado a partir del salario y el factor prestacional.
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_cost_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES sales_items(id) ON DELETE CASCADE,
    role_family VARCHAR(60),
    seniority VARCHAR(20),
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',

    cost_type VARCHAR(20) NOT NULL DEFAULT 'INTERNO'
        CHECK (cost_type IN ('INTERNO', 'SUBCONTRATO', 'PASSTHROUGH')),

    -- Construcción del costo hora para personal interno.
    -- monthly_cost = base_monthly_salary * benefits_factor
    -- hourly_cost  = monthly_cost / productive_hours_month
    base_monthly_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
    -- Factor prestacional colombiano (salud, pensión, ARL, parafiscales,
    -- cesantías, intereses, prima, vacaciones). Típico 1.45 - 1.55.
    benefits_factor DECIMAL(6,4) NOT NULL DEFAULT 1.5000,
    -- Horas realmente facturables al mes tras descontar vacaciones,
    -- capacitación, preventa y administración. Típico 140 - 160.
    productive_hours_month DECIMAL(8,2) NOT NULL DEFAULT 152,
    -- Herramientas, licencias de desarrollo y equipo por persona/mes.
    tooling_cost_month DECIMAL(18,2) NOT NULL DEFAULT 0,

    -- Costo hora resultante. Se calcula en la app y se almacena para
    -- que quede congelado el valor con el que se costeó cada propuesta.
    hourly_cost DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- Tasa de overhead de estructura a imputar sobre el costo directo
    -- para llegar al margen operativo del proyecto.
    overhead_rate DECIMAL(5,2) NOT NULL DEFAULT 0,

    valid_from DATE NOT NULL,
    valid_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_cost_rates_item ON sales_cost_rates(item_id, valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_cost_rates_role ON sales_cost_rates(role_family, seniority, valid_from DESC);

-- =====================================================
-- 4. PIPELINE COMERCIAL
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    third_party_id UUID REFERENCES third_parties(id),
    -- Nombre libre del cliente mientras no exista como tercero formal.
    -- La carpeta de OneDrive suele traer prospectos aún no creados.
    client_name VARCHAR(200),

    stage VARCHAR(30) NOT NULL DEFAULT 'PROSPECCION'
        CHECK (stage IN ('PROSPECCION', 'CALIFICACION', 'PROPUESTA', 'NEGOCIACION', 'GANADA', 'PERDIDA', 'CANCELADA')),
    -- Probabilidad de cierre; multiplica el valor para el pipeline ponderado.
    probability DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),

    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    expected_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    expected_margin DECIMAL(18,2) NOT NULL DEFAULT 0,
    expected_close_date DATE,

    source VARCHAR(40), -- REFERIDO, INBOUND, OUTBOUND, LICITACION, RECOMPRA, ALIANZA
    owner_user_id UUID REFERENCES auth.users(id),
    first_contact_date DATE,
    closed_at DATE,
    -- Solo con esto se puede analizar por qué se pierde margen o volumen.
    loss_reason VARCHAR(40)
        CHECK (loss_reason IS NULL OR loss_reason IN ('PRECIO', 'ALCANCE', 'TIEMPO', 'COMPETIDOR', 'PRESUPUESTO', 'SIN_RESPUESTA', 'INTERNO', 'OTRO')),
    loss_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON sales_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_client ON sales_opportunities(third_party_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_close ON sales_opportunities(expected_close_date);

-- Historial de etapas: sin esto no hay ciclo de venta ni conversión por etapa.
CREATE TABLE IF NOT EXISTS sales_opportunity_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES sales_opportunities(id) ON DELETE CASCADE,
    from_stage VARCHAR(30),
    to_stage VARCHAR(30) NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    days_in_previous_stage INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stage_history_opp ON sales_opportunity_stage_history(opportunity_id, changed_at);

-- =====================================================
-- 5. PROPUESTAS COMERCIALES (versionadas)
--    Una propuesta es una versión inmutable de una oferta.
--    Renegociar genera una versión nueva, nunca edita la anterior:
--    así se puede medir cuánto margen se cede en la negociación.
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID REFERENCES sales_opportunities(id) ON DELETE SET NULL,
    code VARCHAR(40) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(250) NOT NULL,

    third_party_id UUID REFERENCES third_parties(id),
    client_name VARCHAR(200),

    status VARCHAR(20) NOT NULL DEFAULT 'BORRADOR'
        CHECK (status IN ('BORRADOR', 'ENVIADA', 'EN_NEGOCIACION', 'GANADA', 'PERDIDA', 'VENCIDA', 'RETIRADA')),

    issue_date DATE,
    valid_until DATE,
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    -- Tasa a COP usada al momento de cotizar. Congelarla es lo que
    -- permite separar después la desviación de margen por tipo de cambio
    -- de la desviación por ejecución.
    fx_rate DECIMAL(18,6) NOT NULL DEFAULT 1,

    -- Modalidad: determina cómo se reconoce el ingreso y quién asume
    -- el riesgo de sobrecosto.
    engagement_model VARCHAR(30) NOT NULL DEFAULT 'FIXED_PRICE'
        CHECK (engagement_model IN ('FIXED_PRICE', 'TIME_AND_MATERIALS', 'RETAINER', 'SUBSCRIPTION', 'OUTCOME_BASED', 'MIXTO')),

    -- Condiciones comerciales: alimentan el pronóstico de caja.
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    advance_payment_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    -- Cláusula de indexación (IPC/IPP): protege el margen en contratos largos.
    indexation_clause VARCHAR(20)
        CHECK (indexation_clause IS NULL OR indexation_clause IN ('NINGUNA', 'IPC', 'IPP', 'SMLV', 'FIJO')),
    warranty_months INTEGER NOT NULL DEFAULT 0,
    -- Reserva por riesgo incluida en el precio; es margen que existe
    -- solo si el riesgo no se materializa, y hay que reportarlo aparte.
    contingency_rate DECIMAL(5,2) NOT NULL DEFAULT 0,

    estimated_start_date DATE,
    estimated_end_date DATE,
    estimated_duration_months DECIMAL(6,2),

    -- Totales denormalizados (calculados desde las líneas por la app).
    -- Se almacenan para poder listar y rankear sin agregar en cada consulta.
    total_list_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_net_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_direct_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_indirect_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_passthrough DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_hours DECIMAL(12,2) NOT NULL DEFAULT 0,
    gross_margin_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    gross_margin_rate DECIMAL(7,2) NOT NULL DEFAULT 0,
    operating_margin_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    operating_margin_rate DECIMAL(7,2) NOT NULL DEFAULT 0,
    -- Ingreso por hora vendida: el KPI que mejor compara propuestas
    -- de tamaño y alcance distintos en una fábrica de software.
    revenue_per_hour DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- Gobierno de precios: se enciende cuando alguna línea baja del piso
    -- o supera el descuento máximo de la lista.
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,

    -- Trazabilidad al archivo original en la carpeta Comercial.
    source_file_path TEXT,
    source_file_name VARCHAR(300),
    source_file_hash VARCHAR(64),
    source_model_path TEXT,
    source_model_hash VARCHAR(64),
    imported_at TIMESTAMPTZ,
    import_batch_id UUID,
    -- Cuando el parser no logra certeza, la propuesta queda marcada
    -- para revisión humana en lugar de contaminar los indicadores.
    needs_review BOOLEAN NOT NULL DEFAULT false,
    review_notes TEXT,

    notes TEXT,
    owner_user_id UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(code, version)
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON sales_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_client ON sales_proposals(third_party_id);
CREATE INDEX IF NOT EXISTS idx_proposals_opportunity ON sales_proposals(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_proposals_hash ON sales_proposals(source_file_hash);
CREATE INDEX IF NOT EXISTS idx_proposals_review ON sales_proposals(needs_review) WHERE needs_review = true;

-- -----------------------------------------------------
-- 5.1 LÍNEAS DE PROPUESTA
--     El corazón del módulo: precio y margen unitario.
--     Las columnas GENERATED garantizan que el margen nunca
--     se desincronice del precio y el costo que lo produjeron.
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_proposal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES sales_proposals(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_id UUID REFERENCES sales_items(id),

    description TEXT NOT NULL,
    -- Agrupadores que permiten leer el margen por fase, por entregable
    -- o por frente de trabajo, no solo por total de la propuesta.
    workstream VARCHAR(100),
    phase VARCHAR(100),
    deliverable VARCHAR(200),
    sprint_number INTEGER,

    role_family VARCHAR(60),
    seniority VARCHAR(20),

    quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL DEFAULT 'HORA',
    -- Horas equivalentes de la línea. Para líneas en HORA es igual a
    -- quantity; para SPRINT/MES/GLOBAL es la conversión a horas, y es
    -- lo que permite comparar tarifas efectivas entre líneas heterogéneas.
    hours DECIMAL(14,4) NOT NULL DEFAULT 0,

    -- ---- Cascada de precio ----
    unit_list_price DECIMAL(18,4) NOT NULL DEFAULT 0,
    discount_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
    -- Precio unitario neto efectivamente ofrecido al cliente.
    unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- ---- Cascada de costo ----
    -- Costo directo unitario (nómina cargada o subcontrato).
    unit_direct_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    -- Overhead de estructura imputado a la unidad.
    unit_indirect_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    cost_source VARCHAR(20) NOT NULL DEFAULT 'RATE_CARD'
        CHECK (cost_source IN ('RATE_CARD', 'MANUAL', 'SUBCONTRATO', 'IMPORTADO')),
    cost_rate_id UUID REFERENCES sales_cost_rates(id),

    -- Un reembolsable entra al ingreso pero se excluye del margen
    -- para no inflar artificialmente la rentabilidad.
    is_passthrough BOOLEAN NOT NULL DEFAULT false,
    is_optional BOOLEAN NOT NULL DEFAULT false,

    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 19,
    retention_rate DECIMAL(5,2) NOT NULL DEFAULT 0,

    delivery_start_date DATE,
    delivery_end_date DATE,

    revenue_account_code TEXT REFERENCES puc_accounts(code),
    cost_account_code TEXT REFERENCES puc_accounts(code),

    -- ---- Derivados: siempre consistentes con las bases de arriba ----
    list_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * unit_list_price, 2)) STORED,
    discount_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * (unit_list_price - unit_price), 2)) STORED,
    net_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
    direct_cost_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * unit_direct_cost, 2)) STORED,
    indirect_cost_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * unit_indirect_cost, 2)) STORED,
    tax_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * unit_price * tax_rate / 100, 2)) STORED,

    -- Margen unitario: la métrica que pidió el negocio, al nivel de línea.
    unit_gross_margin DECIMAL(18,4)
        GENERATED ALWAYS AS (unit_price - unit_direct_cost) STORED,
    unit_operating_margin DECIMAL(18,4)
        GENERATED ALWAYS AS (unit_price - unit_direct_cost - unit_indirect_cost) STORED,

    gross_margin_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * (unit_price - unit_direct_cost), 2)) STORED,
    operating_margin_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * (unit_price - unit_direct_cost - unit_indirect_cost), 2)) STORED,

    -- Los ratios se acotan porque un costo o un precio de lista cercano a
    -- cero produce cocientes que desbordan la escala y abortarían el INSERT.
    gross_margin_rate DECIMAL(12,4)
        GENERATED ALWAYS AS (
            CASE WHEN unit_price > 0
                 THEN GREATEST(ROUND((unit_price - unit_direct_cost) / unit_price * 100, 4), -99999999)
                 ELSE 0 END
        ) STORED,
    -- Factor multiplicador precio/costo: en servicios profesionales se
    -- lee más rápido que el porcentaje (3.0x ≈ 67% de margen bruto).
    markup_multiple DECIMAL(12,4)
        GENERATED ALWAYS AS (
            CASE WHEN unit_direct_cost > 0
                 THEN LEAST(ROUND(unit_price / unit_direct_cost, 4), 99999999)
                 ELSE 0 END
        ) STORED,
    -- Realización de precio: cuánto del precio de lista se sostuvo.
    price_realization_rate DECIMAL(12,4)
        GENERATED ALWAYS AS (
            CASE WHEN unit_list_price > 0
                 THEN LEAST(ROUND(unit_price / unit_list_price * 100, 4), 99999999)
                 ELSE 100 END
        ) STORED,

    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(proposal_id, line_number),
    CHECK (quantity >= 0),
    CHECK (unit_price >= 0),
    CHECK (discount_rate >= 0 AND discount_rate <= 100)
);

CREATE INDEX IF NOT EXISTS idx_proposal_lines_proposal ON sales_proposal_lines(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_lines_item ON sales_proposal_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_proposal_lines_role ON sales_proposal_lines(role_family, seniority);

-- -----------------------------------------------------
-- 5.2 SUPUESTOS DEL MODELO FINANCIERO
--     Responde "¿por qué este precio?". Sin esto, revisar una
--     propuesta de hace seis meses es arqueología.
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_proposal_assumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES sales_proposals(id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL DEFAULT 'GENERAL'
        CHECK (category IN ('GENERAL', 'COSTO', 'PRECIO', 'ALCANCE', 'PLAZO', 'RIESGO', 'MACRO', 'EQUIPO')),
    key VARCHAR(120) NOT NULL,
    label VARCHAR(250),
    value_numeric DECIMAL(20,6),
    value_text TEXT,
    unit VARCHAR(30),
    -- Celda o rango del modelo financiero de donde salió el dato.
    source_reference VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(proposal_id, key)
);

CREATE INDEX IF NOT EXISTS idx_assumptions_proposal ON sales_proposal_assumptions(proposal_id);

-- -----------------------------------------------------
-- 5.3 ESCENARIOS DEL MODELO FINANCIERO
--     Los modelos suelen traer Base / Optimista / Conservador.
--     Guardarlos permite medir después contra cuál se ejecutó.
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_proposal_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES sales_proposals(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    is_base BOOLEAN NOT NULL DEFAULT false,
    probability DECIMAL(5,2),

    revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
    direct_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    indirect_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    gross_margin DECIMAL(18,2) NOT NULL DEFAULT 0,
    gross_margin_rate DECIMAL(7,2) NOT NULL DEFAULT 0,
    total_hours DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- Indicadores de inversión cuando el modelo los calcula.
    npv DECIMAL(18,2),
    irr DECIMAL(7,4),
    payback_months DECIMAL(6,2),
    discount_rate DECIMAL(7,4),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(proposal_id, name)
);

-- =====================================================
-- 6. CONTRATOS Y EJECUCIÓN
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    third_party_id UUID NOT NULL REFERENCES third_parties(id),
    opportunity_id UUID REFERENCES sales_opportunities(id),
    -- Propuesta ganadora: define la línea base de margen del contrato.
    proposal_id UUID REFERENCES sales_proposals(id),
    project_id UUID REFERENCES projects(id),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
        CHECK (status IN ('BORRADOR', 'ACTIVO', 'SUSPENDIDO', 'FINALIZADO', 'CANCELADO')),
    engagement_model VARCHAR(30) NOT NULL DEFAULT 'FIXED_PRICE',

    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    fx_rate DECIMAL(18,6) NOT NULL DEFAULT 1,
    contract_value DECIMAL(18,2) NOT NULL DEFAULT 0,
    -- Valor de adiciones aprobadas (change orders) sobre el original.
    change_orders_value DECIMAL(18,2) NOT NULL DEFAULT 0,

    signed_date DATE,
    start_date DATE,
    end_date DATE,
    payment_terms_days INTEGER NOT NULL DEFAULT 30,

    auto_renew BOOLEAN NOT NULL DEFAULT false,
    renewal_notice_days INTEGER,
    -- Para suscripciones y AMS: base del ingreso recurrente anual.
    arr_amount DECIMAL(18,2) NOT NULL DEFAULT 0,

    sla_terms TEXT,
    penalty_terms TEXT,
    notes TEXT,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_client ON sales_contracts(third_party_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON sales_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON sales_contracts(project_id);

-- Cierra el ciclo projects <-> sales_contracts sin dependencia circular
-- en el orden de creación de las tablas.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'projects_contract_id_fkey'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT projects_contract_id_fkey
            FOREIGN KEY (contract_id) REFERENCES sales_contracts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Snapshot congelado de las líneas ganadas: la línea base contra la
-- que se mide todo el deterioro de margen durante la ejecución.
CREATE TABLE IF NOT EXISTS sales_contract_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES sales_contracts(id) ON DELETE CASCADE,
    proposal_line_id UUID REFERENCES sales_proposal_lines(id),
    line_number INTEGER NOT NULL,
    item_id UUID REFERENCES sales_items(id),

    description TEXT NOT NULL,
    workstream VARCHAR(100),
    deliverable VARCHAR(200),
    role_family VARCHAR(60),
    seniority VARCHAR(20),

    quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL DEFAULT 'HORA',
    hours DECIMAL(14,4) NOT NULL DEFAULT 0,
    unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
    unit_direct_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    unit_indirect_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    is_passthrough BOOLEAN NOT NULL DEFAULT false,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 19,

    revenue_account_code TEXT REFERENCES puc_accounts(code),
    cost_account_code TEXT REFERENCES puc_accounts(code),

    net_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
    direct_cost_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * unit_direct_cost, 2)) STORED,
    gross_margin_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(quantity * (unit_price - unit_direct_cost), 2)) STORED,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_contract_lines_contract ON sales_contract_lines(contract_id);

-- -----------------------------------------------------
-- 6.1 HITOS DE FACTURACIÓN
--     Puente hacia Facturación, Cartera y Tesorería:
--     cada hito es una factura futura y un ingreso de caja proyectado.
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_billing_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES sales_contracts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    milestone_number INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,

    milestone_type VARCHAR(20) NOT NULL DEFAULT 'ENTREGABLE'
        CHECK (milestone_type IN ('ANTICIPO', 'ENTREGABLE', 'PERIODICO', 'AVANCE', 'RETENCION', 'FINAL')),

    planned_date DATE NOT NULL,
    actual_date DATE,
    percent_of_contract DECIMAL(7,4) NOT NULL DEFAULT 0,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',

    status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (status IN ('PENDIENTE', 'LISTO_FACTURAR', 'FACTURADO', 'COBRADO', 'CANCELADO')),
    -- Condición de aceptación del cliente antes de poder facturar.
    acceptance_required BOOLEAN NOT NULL DEFAULT false,
    accepted_at DATE,

    -- Enlace a la factura emitida. Sin FK dura porque la tabla
    -- `invoices` vive en Supabase y puede no existir al ejecutar este script.
    invoice_id UUID,
    invoiced_at DATE,
    collected_at DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, milestone_number)
);

CREATE INDEX IF NOT EXISTS idx_milestones_contract ON sales_billing_milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON sales_billing_milestones(status, planned_date);
CREATE INDEX IF NOT EXISTS idx_milestones_invoice ON sales_billing_milestones(invoice_id);

-- Agrega la FK a invoices solo si esa tabla ya existe en la base.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'invoices')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'sales_billing_milestones_invoice_id_fkey') THEN
        ALTER TABLE sales_billing_milestones
            ADD CONSTRAINT sales_billing_milestones_invoice_id_fkey
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------
-- 6.2 CALENDARIO DE RECONOCIMIENTO DE INGRESO
--     Facturar y devengar no son lo mismo. Esta tabla es la que
--     genera el ingreso diferido y la obra en curso en contabilidad.
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_revenue_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES sales_contracts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),

    method VARCHAR(20) NOT NULL DEFAULT 'POC'
        CHECK (method IN ('POC', 'LINEAL', 'HITO', 'ENTREGA')),

    planned_revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
    recognized_revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
    planned_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    recognized_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    invoiced_amount DECIMAL(18,2) NOT NULL DEFAULT 0,

    -- Positivo: se devengó más de lo facturado -> obra en curso (activo).
    -- Negativo: se facturó más de lo devengado -> ingreso diferido (pasivo).
    wip_balance DECIMAL(18,2)
        GENERATED ALWAYS AS (recognized_revenue - invoiced_amount) STORED,

    journal_entry_id UUID REFERENCES journal_entries(id),
    is_closed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_revenue_schedule_period ON sales_revenue_schedule(period_year, period_month);

-- -----------------------------------------------------
-- 6.3 HORAS REALES
--     Convierte el margen presupuestado en margen real.
--     Sin horas cargadas, el seguimiento de margen es ficción.
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS project_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_line_id UUID REFERENCES sales_contract_lines(id),
    employee_id UUID, -- FK a employees; puede no existir aún la tabla
    third_party_id UUID REFERENCES third_parties(id), -- contratistas
    work_date DATE NOT NULL,
    hours DECIMAL(8,2) NOT NULL DEFAULT 0,
    -- Horas no facturables (retrabajo, garantía, sobrecosto de alcance)
    -- son la principal fuga de margen y deben poder aislarse.
    is_billable BOOLEAN NOT NULL DEFAULT true,
    non_billable_reason VARCHAR(30)
        CHECK (non_billable_reason IS NULL OR non_billable_reason IN ('RETRABAJO', 'GARANTIA', 'SOBRECOSTO_ALCANCE', 'CAPACITACION', 'PREVENTA', 'INTERNO')),
    role_family VARCHAR(60),
    seniority VARCHAR(20),
    -- Costo hora vigente al momento de cargar la hora.
    hourly_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    cost_amount DECIMAL(18,2)
        GENERATED ALWAYS AS (ROUND(hours * hourly_cost, 2)) STORED,
    description TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_project ON project_time_entries(project_id, work_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON project_time_entries(employee_id, work_date);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'employees')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'project_time_entries_employee_id_fkey') THEN
        ALTER TABLE project_time_entries
            ADD CONSTRAINT project_time_entries_employee_id_fkey
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =====================================================
-- 7. STAGING DE IMPORTACIÓN (carpeta Comercial)
--    Todo archivo entra primero aquí. Nada llega a las tablas
--    de negocio sin pasar por revisión, y reimportar el mismo
--    archivo dos veces no duplica nada gracias al hash.
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(30) NOT NULL DEFAULT 'ONEDRIVE_CLI'
        CHECK (source IN ('ONEDRIVE_CLI', 'UPLOAD_WEB', 'MANUAL', 'API')),
    root_path TEXT,
    machine_name VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'EN_PROCESO'
        CHECK (status IN ('EN_PROCESO', 'COMPLETADO', 'CON_ERRORES', 'CANCELADO')),
    files_scanned INTEGER NOT NULL DEFAULT 0,
    files_imported INTEGER NOT NULL DEFAULT 0,
    files_skipped INTEGER NOT NULL DEFAULT 0,
    files_failed INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    error_summary TEXT
);

CREATE TABLE IF NOT EXISTS sales_import_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES sales_import_batches(id) ON DELETE CASCADE,

    -- Ruta relativa a la raíz de la carpeta Comercial.
    relative_path TEXT NOT NULL,
    file_name VARCHAR(300) NOT NULL,
    file_extension VARCHAR(10),
    file_size_bytes BIGINT,
    file_modified_at TIMESTAMPTZ,
    -- SHA-256 del contenido: clave de idempotencia.
    file_hash VARCHAR(64) NOT NULL,

    -- Carpeta de primer nivel = cliente, por convención de la carpeta.
    detected_client_folder VARCHAR(200),
    detected_client_id UUID REFERENCES third_parties(id),
    document_kind VARCHAR(20) NOT NULL DEFAULT 'DESCONOCIDO'
        CHECK (document_kind IN ('PROPUESTA', 'MODELO_FINANCIERO', 'SOW', 'PRESENTACION', 'ANEXO', 'DESCONOCIDO')),
    detected_version VARCHAR(20),
    detected_date DATE,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (status IN ('PENDIENTE', 'PARSEADO', 'IMPORTADO', 'DUPLICADO', 'IGNORADO', 'ERROR')),
    -- Payload normalizado que produjo el parser, tal cual llegó.
    -- Permite reprocesar sin volver a tocar la máquina del usuario.
    parsed_payload JSONB,
    parse_confidence DECIMAL(5,2),
    proposal_id UUID REFERENCES sales_proposals(id) ON DELETE SET NULL,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(file_hash)
);

CREATE INDEX IF NOT EXISTS idx_import_files_batch ON sales_import_files(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_files_status ON sales_import_files(status);
CREATE INDEX IF NOT EXISTS idx_import_files_client ON sales_import_files(detected_client_folder);

-- Perfiles de mapeo: enseñan al parser dónde vive cada dato en los
-- modelos financieros de un cliente o plantilla concreta.
CREATE TABLE IF NOT EXISTS sales_import_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    -- Patrón de nombre de archivo o carpeta al que aplica el perfil.
    match_pattern VARCHAR(250),
    -- { "sheet": "...", "header_row": 8, "columns": { "unit_price": "Tarifa", ... } }
    mapping JSONB NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 8. ENLACES TRANSVERSALES CON EL RESTO DEL ERP
--    Agregar la dimensión proyecto a las tablas existentes es lo
--    que convierte a Ventas en un módulo transversal y no en una isla.
-- =====================================================

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['journal_lines', 'invoice_lines', 'invoices', 'payroll_lines', 'bank_movements', 'voucher_lines'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL', t);
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_project ON %I(project_id)', t, t);
        END IF;
    END LOOP;

    -- El centro de costo se necesita en el asiento para separar
    -- estructura de operación en el estado de resultados.
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'journal_lines') THEN
        ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL;
    END IF;

    -- Trazabilidad factura -> línea contratada: sin esto no se puede
    -- comparar lo vendido contra lo facturado a nivel de línea.
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'invoice_lines') THEN
        ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS contract_line_id UUID REFERENCES sales_contract_lines(id) ON DELETE SET NULL;
        ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES sales_billing_milestones(id) ON DELETE SET NULL;
        -- Costo unitario trasladado desde la línea contratada: permite
        -- calcular el margen real directamente sobre la factura emitida.
        ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(18,4) DEFAULT 0;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'invoices') THEN
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES sales_contracts(id) ON DELETE SET NULL;
    END IF;

    -- Clasificación de cliente para análisis de concentración y LTV.
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'third_parties') THEN
        ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS client_segment VARCHAR(40);
        ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS client_since DATE;
        ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS default_price_list_id UUID REFERENCES sales_price_lists(id) ON DELETE SET NULL;
        ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS commercial_folder VARCHAR(200);
    END IF;
END $$;

-- =====================================================
-- 9. VISTAS DE SEGUIMIENTO FINANCIERO
-- =====================================================

-- Se eliminan antes de recrearlas: CREATE OR REPLACE VIEW no admite
-- cambios en el orden ni en el nombre de las columnas, y este script
-- debe poder re-ejecutarse cuando una vista evolucione.
DROP VIEW IF EXISTS v_sales_proposal_margin CASCADE;
DROP VIEW IF EXISTS v_sales_margin_by_role CASCADE;
DROP VIEW IF EXISTS v_sales_pipeline CASCADE;
DROP VIEW IF EXISTS v_project_margin_tracking CASCADE;
DROP VIEW IF EXISTS v_sales_client_profitability CASCADE;
DROP VIEW IF EXISTS v_sales_backlog CASCADE;

-- 9.1 Cascada de margen por propuesta.
-- Lee de arriba abajo cómo el precio de lista se convierte en margen operativo.
CREATE OR REPLACE VIEW v_sales_proposal_margin AS
SELECT
    p.id,
    p.code,
    p.version,
    p.title,
    p.status,
    p.currency,
    p.fx_rate,
    p.engagement_model,
    COALESCE(tp.full_name, p.client_name) AS client_name,
    p.third_party_id,
    p.issue_date,

    SUM(l.list_amount)                                   AS list_amount,
    SUM(l.discount_amount)                               AS discount_amount,
    SUM(l.net_amount)                                    AS net_revenue,
    SUM(l.net_amount) FILTER (WHERE l.is_passthrough)    AS passthrough_revenue,
    SUM(l.direct_cost_amount)                            AS direct_cost,
    SUM(l.indirect_cost_amount)                          AS indirect_cost,
    SUM(l.gross_margin_amount)                           AS gross_margin,
    SUM(l.operating_margin_amount)                       AS operating_margin,
    SUM(l.hours)                                         AS total_hours,

    -- Ingreso propio, sin reembolsables. Es la base correcta para juzgar
    -- rentabilidad: facturar cloud al costo infla el ingreso y hunde el
    -- porcentaje de margen sin que la operación haya empeorado.
    SUM(l.net_amount) FILTER (WHERE NOT l.is_passthrough) AS net_revenue_ex_passthrough,

    CASE WHEN SUM(l.net_amount) <> 0
         THEN ROUND(SUM(l.gross_margin_amount) / SUM(l.net_amount) * 100, 2) ELSE 0 END      AS gross_margin_rate,
    CASE WHEN SUM(l.net_amount) FILTER (WHERE NOT l.is_passthrough) <> 0
         THEN ROUND(SUM(l.gross_margin_amount) / SUM(l.net_amount) FILTER (WHERE NOT l.is_passthrough) * 100, 2)
         ELSE 0 END                                                                          AS gross_margin_rate_ex_passthrough,
    CASE WHEN SUM(l.net_amount) <> 0
         THEN ROUND(SUM(l.operating_margin_amount) / SUM(l.net_amount) * 100, 2) ELSE 0 END  AS operating_margin_rate,
    CASE WHEN SUM(l.list_amount) <> 0
         THEN ROUND(SUM(l.net_amount) / SUM(l.list_amount) * 100, 2) ELSE 100 END            AS price_realization_rate,
    CASE WHEN SUM(l.hours) <> 0
         THEN ROUND(SUM(l.net_amount) / SUM(l.hours), 2) ELSE 0 END                          AS revenue_per_hour,
    CASE WHEN SUM(l.hours) <> 0
         THEN ROUND(SUM(l.gross_margin_amount) / SUM(l.hours), 2) ELSE 0 END                 AS margin_per_hour,
    -- Todo expresado en moneda funcional para poder consolidar.
    ROUND(SUM(l.net_amount) * p.fx_rate, 2)              AS net_revenue_cop,
    ROUND(SUM(l.gross_margin_amount) * p.fx_rate, 2)     AS gross_margin_cop
FROM sales_proposals p
LEFT JOIN sales_proposal_lines l ON l.proposal_id = p.id
LEFT JOIN third_parties tp ON tp.id = p.third_party_id
GROUP BY p.id, tp.full_name;

-- 9.2 Rentabilidad por rol y seniority a través de todas las propuestas.
-- Responde: ¿qué perfiles estamos vendiendo bien y cuáles regalamos?
CREATE OR REPLACE VIEW v_sales_margin_by_role AS
SELECT
    l.role_family,
    l.seniority,
    p.status,
    COUNT(DISTINCT p.id)                          AS proposals,
    SUM(l.hours)                                  AS total_hours,
    ROUND(AVG(l.unit_list_price), 2)              AS avg_list_price,
    ROUND(AVG(l.unit_price), 2)                   AS avg_unit_price,
    ROUND(MIN(l.unit_price), 2)                   AS min_unit_price,
    ROUND(MAX(l.unit_price), 2)                   AS max_unit_price,
    ROUND(AVG(l.unit_direct_cost), 2)             AS avg_unit_cost,
    ROUND(AVG(l.unit_gross_margin), 2)            AS avg_unit_margin,
    ROUND(AVG(l.gross_margin_rate), 2)            AS avg_margin_rate,
    ROUND(AVG(l.markup_multiple), 2)              AS avg_markup_multiple,
    ROUND(AVG(l.discount_rate), 2)                AS avg_discount_rate,
    SUM(l.net_amount)                             AS net_revenue,
    SUM(l.gross_margin_amount)                    AS gross_margin
FROM sales_proposal_lines l
JOIN sales_proposals p ON p.id = l.proposal_id
WHERE l.role_family IS NOT NULL
GROUP BY l.role_family, l.seniority, p.status;

-- 9.3 Pipeline ponderado: cuánto ingreso y margen hay realmente en juego.
CREATE OR REPLACE VIEW v_sales_pipeline AS
SELECT
    o.id,
    o.code,
    o.name,
    o.stage,
    o.probability,
    o.currency,
    COALESCE(tp.full_name, o.client_name) AS client_name,
    o.expected_close_date,
    o.owner_user_id,
    o.expected_amount,
    ROUND(o.expected_amount * o.probability / 100, 2) AS weighted_amount,
    ROUND(o.expected_margin * o.probability / 100, 2) AS weighted_margin,
    -- La propuesta vigente es siempre la de mayor versión.
    lp.code    AS latest_proposal_code,
    lp.version AS latest_proposal_version,
    lp.gross_margin_rate AS latest_proposal_margin_rate,
    CASE
        WHEN o.stage IN ('GANADA', 'PERDIDA', 'CANCELADA') THEN NULL
        ELSE (o.expected_close_date - CURRENT_DATE)
    END AS days_to_close,
    (CURRENT_DATE - o.first_contact_date) AS days_in_pipeline
FROM sales_opportunities o
LEFT JOIN third_parties tp ON tp.id = o.third_party_id
LEFT JOIN LATERAL (
    SELECT sp.code, sp.version, sp.gross_margin_rate
    FROM sales_proposals sp
    WHERE sp.opportunity_id = o.id
    ORDER BY sp.version DESC
    LIMIT 1
) lp ON true;

-- 9.4 Seguimiento de margen plan vs. real por proyecto.
-- Es la vista que responde "¿este proyecto está ganando lo que prometimos?".
CREATE OR REPLACE VIEW v_project_margin_tracking AS
WITH actual_hours AS (
    SELECT
        project_id,
        SUM(hours)                                        AS hours_worked,
        SUM(hours) FILTER (WHERE is_billable)             AS billable_hours,
        SUM(hours) FILTER (WHERE NOT is_billable)         AS non_billable_hours,
        SUM(cost_amount)                                  AS actual_direct_cost
    FROM project_time_entries
    GROUP BY project_id
),
invoiced AS (
    SELECT
        project_id,
        SUM(amount) FILTER (WHERE status IN ('FACTURADO', 'COBRADO')) AS invoiced_amount,
        SUM(amount) FILTER (WHERE status = 'COBRADO')                 AS collected_amount,
        SUM(amount) FILTER (WHERE status = 'PENDIENTE')               AS backlog_amount,
        SUM(amount) FILTER (WHERE status = 'LISTO_FACTURAR')          AS ready_to_invoice_amount
    FROM sales_billing_milestones
    GROUP BY project_id
)
SELECT
    pr.id                                   AS project_id,
    pr.code,
    pr.name,
    pr.status,
    tp.full_name                            AS client_name,
    pr.currency,
    pr.percent_complete,

    pr.baseline_revenue,
    pr.baseline_direct_cost,
    pr.baseline_margin,
    pr.baseline_hours,
    pr.budget_revenue,
    pr.budget_direct_cost,
    pr.budget_hours,

    COALESCE(ah.hours_worked, 0)            AS hours_worked,
    COALESCE(ah.billable_hours, 0)          AS billable_hours,
    COALESCE(ah.non_billable_hours, 0)      AS non_billable_hours,
    COALESCE(ah.actual_direct_cost, 0)      AS actual_direct_cost,

    COALESCE(iv.invoiced_amount, 0)         AS invoiced_amount,
    COALESCE(iv.collected_amount, 0)        AS collected_amount,
    COALESCE(iv.ready_to_invoice_amount, 0) AS ready_to_invoice_amount,
    COALESCE(iv.backlog_amount, 0)          AS backlog_amount,

    -- Costo estimado a terminación: extrapola el desempeño real de costo
    -- al alcance restante. Es la señal temprana de pérdida de margen.
    CASE
        WHEN pr.percent_complete > 0
            THEN ROUND(COALESCE(ah.actual_direct_cost, 0) / (pr.percent_complete / 100), 2)
        ELSE pr.budget_direct_cost
    END                                     AS estimated_cost_at_completion,

    -- Margen proyectado con el costo a terminación.
    pr.budget_revenue - CASE
        WHEN pr.percent_complete > 0
            THEN ROUND(COALESCE(ah.actual_direct_cost, 0) / (pr.percent_complete / 100), 2)
        ELSE pr.budget_direct_cost
    END                                     AS forecast_margin,

    -- Deterioro frente a la línea base: lo que se prometió al vender
    -- menos lo que hoy se espera realmente ganar.
    (pr.budget_revenue - CASE
        WHEN pr.percent_complete > 0
            THEN ROUND(COALESCE(ah.actual_direct_cost, 0) / (pr.percent_complete / 100), 2)
        ELSE pr.budget_direct_cost
    END) - pr.baseline_margin               AS margin_variance,

    CASE WHEN pr.budget_hours <> 0
         THEN ROUND(COALESCE(ah.hours_worked, 0) / pr.budget_hours * 100, 2) ELSE 0 END AS hours_consumption_rate,
    CASE WHEN COALESCE(ah.billable_hours, 0) <> 0
         THEN ROUND(COALESCE(iv.invoiced_amount, 0) / ah.billable_hours, 2) ELSE 0 END  AS effective_hourly_rate
FROM projects pr
LEFT JOIN third_parties tp ON tp.id = pr.third_party_id
LEFT JOIN actual_hours ah ON ah.project_id = pr.id
LEFT JOIN invoiced iv ON iv.project_id = pr.id;

-- 9.5 Rentabilidad y concentración por cliente.
CREATE OR REPLACE VIEW v_sales_client_profitability AS
SELECT
    tp.id                                   AS third_party_id,
    tp.full_name                            AS client_name,
    tp.client_segment,
    tp.client_since,
    COUNT(DISTINCT c.id)                    AS contracts,
    COUNT(DISTINCT pr.id)                   AS projects,
    SUM(c.contract_value + c.change_orders_value) AS contracted_value,
    SUM(pr.baseline_margin)                 AS baseline_margin,
    CASE WHEN SUM(pr.baseline_revenue) <> 0
         THEN ROUND(SUM(pr.baseline_margin) / SUM(pr.baseline_revenue) * 100, 2)
         ELSE 0 END                         AS baseline_margin_rate,
    MAX(c.signed_date)                      AS last_contract_date,
    SUM(c.arr_amount)                       AS arr
FROM third_parties tp
LEFT JOIN sales_contracts c ON c.third_party_id = tp.id AND c.status <> 'CANCELADO'
LEFT JOIN projects pr ON pr.third_party_id = tp.id
WHERE tp.is_client = true
GROUP BY tp.id;

-- 9.6 Backlog contratado no facturado: la base del pronóstico de caja
-- que consume Tesorería.
CREATE OR REPLACE VIEW v_sales_backlog AS
SELECT
    m.id                                    AS milestone_id,
    c.id                                    AS contract_id,
    c.code                                  AS contract_code,
    tp.full_name                            AS client_name,
    pr.code                                 AS project_code,
    m.name                                  AS milestone_name,
    m.milestone_type,
    m.planned_date,
    m.amount,
    m.tax_amount,
    m.currency,
    m.status,
    c.payment_terms_days,
    -- Fecha esperada de caja: hito facturado más el plazo pactado.
    (m.planned_date + (c.payment_terms_days || ' days')::interval)::date AS expected_cash_date,
    (m.planned_date - CURRENT_DATE)                  AS days_to_planned_date,
    GREATEST(CURRENT_DATE - m.planned_date, 0)       AS days_overdue
FROM sales_billing_milestones m
JOIN sales_contracts c ON c.id = m.contract_id
LEFT JOIN third_parties tp ON tp.id = c.third_party_id
LEFT JOIN projects pr ON pr.id = m.project_id
WHERE m.status IN ('PENDIENTE', 'LISTO_FACTURAR')
  AND c.status = 'ACTIVO';

-- =====================================================
-- 10. RLS
-- =====================================================

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'cost_centers', 'projects', 'sales_items', 'sales_price_lists', 'sales_price_list_items',
        'sales_cost_rates', 'sales_opportunities', 'sales_opportunity_stage_history',
        'sales_proposals', 'sales_proposal_lines', 'sales_proposal_assumptions', 'sales_proposal_scenarios',
        'sales_contracts', 'sales_contract_lines', 'sales_billing_milestones', 'sales_revenue_schedule',
        'project_time_entries', 'sales_import_batches', 'sales_import_files', 'sales_import_mappings'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            t || '_all', t
        );
    END LOOP;
END $$;

-- =====================================================
-- 11. PERMISOS RBAC PARA EL MÓDULO
-- =====================================================

INSERT INTO role_permissions (role_id, module, can_read, can_write, can_delete, can_approve)
SELECT ur.id, m.module, true, true, true, true
FROM user_roles ur
CROSS JOIN (VALUES ('ventas'), ('proyectos')) AS m(module)
WHERE ur.name = 'Administrador'
ON CONFLICT DO NOTHING;

-- Contador: lectura de ventas para conciliar ingreso devengado y facturado.
INSERT INTO role_permissions (role_id, module, can_read, can_write, can_delete, can_approve)
SELECT ur.id, m.module, true, false, false, false
FROM user_roles ur
CROSS JOIN (VALUES ('ventas'), ('proyectos')) AS m(module)
WHERE ur.name IN ('Contador', 'Consulta')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 12. DATOS SEMILLA
--     Catálogo de roles y tarifas de referencia de una fábrica
--     de software. Ajustar a la realidad de HPlus antes de operar.
-- =====================================================

INSERT INTO cost_centers (code, name, center_type) VALUES
    ('OP',    'Operación / Delivery', 'OPERATIVO'),
    ('COM',   'Comercial',            'COMERCIAL'),
    ('ADM',   'Administración',       'ESTRUCTURA')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sales_items (code, name, item_type, unit, role_family, seniority, default_tax_rate, is_recurring) VALUES
    ('ROL-PM-SR',    'Project Manager Senior',        'ROL', 'HORA', 'PROJECT_MANAGEMENT', 'SENIOR',     19, false),
    ('ROL-TL-SR',    'Tech Lead Senior',              'ROL', 'HORA', 'ARQUITECTURA',       'SENIOR',     19, false),
    ('ROL-DEV-SR',   'Desarrollador Senior',          'ROL', 'HORA', 'DESARROLLO',         'SENIOR',     19, false),
    ('ROL-DEV-SSR',  'Desarrollador Semi Senior',     'ROL', 'HORA', 'DESARROLLO',         'SEMISENIOR', 19, false),
    ('ROL-DEV-JR',   'Desarrollador Junior',          'ROL', 'HORA', 'DESARROLLO',         'JUNIOR',     19, false),
    ('ROL-AI-SR',    'Ingeniero de IA Senior',        'ROL', 'HORA', 'INTELIGENCIA_ARTIFICIAL', 'SENIOR', 19, false),
    ('ROL-DATA-SR',  'Ingeniero de Datos Senior',     'ROL', 'HORA', 'DATOS',              'SENIOR',     19, false),
    ('ROL-QA-SSR',   'QA Automation Semi Senior',     'ROL', 'HORA', 'CALIDAD',            'SEMISENIOR', 19, false),
    ('ROL-UX-SR',    'Diseñador UX/UI Senior',        'ROL', 'HORA', 'DISENO',             'SENIOR',     19, false),
    ('ROL-DEVOPS',   'Ingeniero DevOps Senior',       'ROL', 'HORA', 'INFRAESTRUCTURA',    'SENIOR',     19, false),
    ('ENT-DISCOVERY','Discovery y Context Lake',      'ENTREGABLE', 'GLOBAL', NULL, NULL,                19, false),
    ('ENT-MVP',      'MVP a producción',              'ENTREGABLE', 'GLOBAL', NULL, NULL,                19, false),
    ('SOP-AMS',      'Soporte y evolutivos (AMS)',    'SOPORTE',    'MES',    NULL, NULL,                19, true),
    ('LIC-SAAS',     'Licenciamiento SaaS',           'LICENCIA',   'MES',    NULL, NULL,                19, true),
    ('INF-CLOUD',    'Infraestructura cloud',         'INFRA',      'MES',    NULL, NULL,                19, true),
    ('REE-VIAJES',   'Viajes y viáticos reembolsables','REEMBOLSABLE','UNIDAD',NULL, NULL,                0, false)
ON CONFLICT (code) DO NOTHING;

UPDATE sales_items SET is_passthrough = true WHERE code IN ('REE-VIAJES', 'INF-CLOUD');

INSERT INTO sales_price_lists (code, name, currency, segment, valid_from, is_default)
VALUES ('LP-COP-2026', 'Lista base COP 2026', 'COP', 'CORPORATIVO', DATE '2026-01-01', true)
ON CONFLICT (code) DO NOTHING;
