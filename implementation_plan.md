# 📋 Plan de Implementación - DigiKawsay
## Software Contable Colombiano con Arquitectura de Microservicios

---

## 🏗️ ARQUITECTURA PROPUESTA

### Arquitectura Actual (Monolítica)
```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Server Actions (Todo junto)            ││
│  │  - accounting.ts  - puc.ts  - vouchers.ts          ││
│  │  - reports.ts     - users.ts - third-parties.ts    ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                BACKEND (FastAPI - Solo Chat)            │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                │
└─────────────────────────────────────────────────────────┘
```

### Arquitectura Objetivo (Microservicios Desacoplados)
```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│              UI + API Gateway (BFF Pattern)              │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  ACCOUNTING   │  │   BILLING     │  │   PAYROLL     │
│   SERVICE     │  │   SERVICE     │  │   SERVICE     │
│  (FastAPI)    │  │  (FastAPI)    │  │  (FastAPI)    │
│               │  │               │  │               │
│ - Asientos    │  │ - Facturas    │  │ - Nómina      │
│ - PUC         │  │ - DIAN FE     │  │ - DIAN NE     │
│ - Terceros    │  │ - Notas       │  │ - Prestaciones│
│ - Reportes    │  │ - Impuestos   │  │ - Aportes     │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   TREASURY    │  │   AI/CHAT     │  │  INTEGRATION  │
│   SERVICE     │  │   SERVICE     │  │   SERVICE     │
│  (FastAPI)    │  │  (FastAPI)    │  │  (FastAPI)    │
│               │  │               │  │               │
│ - Bancos      │  │ - DigiCFO     │  │ - DIAN API    │
│ - Conciliación│  │ - Anomalías   │  │ - Bancos API  │
│ - Flujo caja  │  │ - Predicción  │  │ - Webhooks    │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│              MESSAGE BROKER (Redis/RabbitMQ)            │
│                    Event-Driven Architecture            │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE (PostgreSQL)                  │
│               + Row Level Security (RLS)                │
└─────────────────────────────────────────────────────────┘
```

---

## 📅 FASES DE IMPLEMENTACIÓN

### FASE 0: PREPARACIÓN Y MIGRACIONES (1-2 días)
**Objetivo**: Estabilizar la base actual

#### Tareas:
- [ ] 0.1 Ejecutar migraciones pendientes en Supabase
- [ ] 0.2 Verificar estructura de tablas actual
- [ ] 0.3 Crear estructura de carpetas para microservicios
- [ ] 0.4 Configurar variables de entorno centralizadas

#### Test:
```bash
# Verificar tablas en Supabase
curl -X GET "$SUPABASE_URL/rest/v1/puc_accounts?limit=1" -H "apikey: $SUPABASE_KEY"
curl -X GET "$SUPABASE_URL/rest/v1/third_parties?limit=1" -H "apikey: $SUPABASE_KEY"
curl -X GET "$SUPABASE_URL/rest/v1/journal_entries?limit=1" -H "apikey: $SUPABASE_KEY"
curl -X GET "$SUPABASE_URL/rest/v1/vouchers?limit=1" -H "apikey: $SUPABASE_KEY"
```

---

### FASE 1: MICROSERVICIO DE CONTABILIDAD (3-5 días)
**Objetivo**: Extraer lógica contable a servicio independiente

#### 1.1 Estructura del Servicio
```
/app/services/accounting/
├── main.py              # FastAPI app
├── config.py            # Configuración
├── models/
│   ├── __init__.py
│   ├── puc.py          # Modelos PUC
│   ├── third_party.py  # Modelos Terceros
│   ├── journal.py      # Modelos Asientos
│   └── schemas.py      # Pydantic schemas
├── services/
│   ├── __init__.py
│   ├── puc_service.py
│   ├── third_party_service.py
│   ├── journal_service.py
│   └── report_service.py
├── routers/
│   ├── __init__.py
│   ├── puc.py
│   ├── third_parties.py
│   ├── journal.py
│   └── reports.py
├── utils/
│   ├── __init__.py
│   ├── dian.py         # Validaciones DIAN
│   └── validators.py
├── requirements.txt
└── Dockerfile
```

#### 1.2 Endpoints a Implementar
```
GET    /api/v1/puc/accounts
GET    /api/v1/puc/accounts/{code}
POST   /api/v1/puc/accounts
PUT    /api/v1/puc/accounts/{code}
DELETE /api/v1/puc/accounts/{code}

GET    /api/v1/third-parties
GET    /api/v1/third-parties/{id}
POST   /api/v1/third-parties
PUT    /api/v1/third-parties/{id}
DELETE /api/v1/third-parties/{id}
GET    /api/v1/third-parties/validate-nit/{nit}

GET    /api/v1/journal/entries
GET    /api/v1/journal/entries/{id}
POST   /api/v1/journal/entries
PUT    /api/v1/journal/entries/{id}/approve
PUT    /api/v1/journal/entries/{id}/reject
DELETE /api/v1/journal/entries/{id}

GET    /api/v1/reports/trial-balance
GET    /api/v1/reports/income-statement
GET    /api/v1/reports/balance-sheet
GET    /api/v1/reports/ledger/{account_code}
```

#### Test Fase 1:
```bash
# Test endpoints contabilidad
curl http://localhost:8002/api/v1/puc/accounts
curl http://localhost:8002/api/v1/third-parties
curl http://localhost:8002/api/v1/journal/entries
curl http://localhost:8002/api/v1/reports/trial-balance
```

---

### FASE 2: MICROSERVICIO DE FACTURACIÓN (5-7 días)
**Objetivo**: Implementar facturación con soporte para DIAN

#### 2.1 Estructura del Servicio
```
/app/services/billing/
├── main.py
├── config.py
├── models/
│   ├── invoice.py       # Factura de venta
│   ├── purchase.py      # Factura de compra
│   ├── credit_note.py   # Nota crédito
│   ├── debit_note.py    # Nota débito
│   └── schemas.py
├── services/
│   ├── invoice_service.py
│   ├── tax_service.py
│   ├── dian_service.py  # Integración DIAN (preparado)
│   └── pdf_service.py
├── routers/
│   ├── invoices.py
│   ├── purchases.py
│   ├── credit_notes.py
│   └── taxes.py
├── templates/
│   ├── invoice_pdf.html
│   └── credit_note_pdf.html
├── requirements.txt
└── Dockerfile
```

#### 2.2 Modelo de Datos - Facturas
```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prefix VARCHAR(4) NOT NULL,          -- Prefijo autorizado DIAN
    number INTEGER NOT NULL,              -- Consecutivo
    type VARCHAR(20) NOT NULL,            -- VENTA, COMPRA
    date TIMESTAMP NOT NULL,
    due_date TIMESTAMP,
    third_party_id UUID REFERENCES third_parties(id),
    
    -- Totales
    subtotal NUMERIC(20,2) DEFAULT 0,
    discount NUMERIC(20,2) DEFAULT 0,
    iva_5 NUMERIC(20,2) DEFAULT 0,
    iva_19 NUMERIC(20,2) DEFAULT 0,
    iva_excluded NUMERIC(20,2) DEFAULT 0,
    consumption_tax NUMERIC(20,2) DEFAULT 0,
    retention_source NUMERIC(20,2) DEFAULT 0,
    retention_iva NUMERIC(20,2) DEFAULT 0,
    retention_ica NUMERIC(20,2) DEFAULT 0,
    total NUMERIC(20,2) DEFAULT 0,
    
    -- DIAN FE (preparado para integración futura)
    cufe VARCHAR(96),                     -- Código único factura
    qr_code TEXT,
    dian_response JSONB,
    dian_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SENT, APPROVED, REJECTED
    
    -- Contabilización
    journal_entry_id UUID REFERENCES journal_entries(id),
    state VARCHAR(20) DEFAULT 'DRAFT',    -- DRAFT, APPROVED, SENT, CANCELLED
    
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(prefix, number)
);

CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    product_code VARCHAR(50),
    description TEXT NOT NULL,
    quantity NUMERIC(10,3) NOT NULL,
    unit VARCHAR(20) DEFAULT 'UN',
    unit_price NUMERIC(20,2) NOT NULL,
    discount_rate NUMERIC(5,2) DEFAULT 0,
    discount_amount NUMERIC(20,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 19,     -- 0, 5, 19
    tax_amount NUMERIC(20,2) DEFAULT 0,
    subtotal NUMERIC(20,2) NOT NULL,
    total NUMERIC(20,2) NOT NULL,
    account_code VARCHAR(10) REFERENCES puc_accounts(code)
);
```

#### 2.3 Endpoints Facturación
```
GET    /api/v1/invoices
GET    /api/v1/invoices/{id}
POST   /api/v1/invoices
PUT    /api/v1/invoices/{id}
POST   /api/v1/invoices/{id}/approve
POST   /api/v1/invoices/{id}/cancel
GET    /api/v1/invoices/{id}/pdf

GET    /api/v1/purchases
POST   /api/v1/purchases

GET    /api/v1/credit-notes
POST   /api/v1/credit-notes

GET    /api/v1/taxes/rates
GET    /api/v1/taxes/calculate
```

#### Test Fase 2:
```bash
# Crear factura de venta
curl -X POST http://localhost:8003/api/v1/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "type": "VENTA",
    "third_party_id": "uuid",
    "lines": [
      {"description": "Servicio", "quantity": 1, "unit_price": 1000000, "tax_rate": 19}
    ]
  }'

# Obtener PDF
curl http://localhost:8003/api/v1/invoices/{id}/pdf -o factura.pdf
```

---

### FASE 3: MICROSERVICIO DE TESORERÍA (3-4 días)
**Objetivo**: Gestión de bancos y flujo de caja

#### 3.1 Estructura
```
/app/services/treasury/
├── main.py
├── models/
│   ├── bank_account.py
│   ├── bank_movement.py
│   ├── reconciliation.py
│   └── cash_flow.py
├── services/
│   ├── bank_service.py
│   ├── reconciliation_service.py
│   └── cash_flow_service.py
├── routers/
│   ├── banks.py
│   ├── movements.py
│   └── reconciliation.py
└── requirements.txt
```

#### 3.2 Modelo de Datos - Bancos
```sql
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    account_type VARCHAR(20) NOT NULL,    -- AHORROS, CORRIENTE
    currency VARCHAR(3) DEFAULT 'COP',
    initial_balance NUMERIC(20,2) DEFAULT 0,
    current_balance NUMERIC(20,2) DEFAULT 0,
    puc_account_code VARCHAR(10) REFERENCES puc_accounts(code),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bank_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_account_id UUID REFERENCES bank_accounts(id),
    date TIMESTAMP NOT NULL,
    type VARCHAR(20) NOT NULL,            -- DEPOSIT, WITHDRAWAL, TRANSFER, FEE
    reference VARCHAR(100),
    description TEXT,
    amount NUMERIC(20,2) NOT NULL,
    balance_after NUMERIC(20,2),
    
    -- Conciliación
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_with UUID,                 -- ID del movimiento contable
    reconciled_at TIMESTAMP,
    
    -- Origen del movimiento
    source_type VARCHAR(50),              -- INVOICE, PAYMENT, MANUAL
    source_id UUID,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bank_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_account_id UUID REFERENCES bank_accounts(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    statement_balance NUMERIC(20,2) NOT NULL,
    book_balance NUMERIC(20,2) NOT NULL,
    reconciled_balance NUMERIC(20,2),
    difference NUMERIC(20,2),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, COMPLETED
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3.3 Endpoints Tesorería
```
GET    /api/v1/banks
POST   /api/v1/banks
GET    /api/v1/banks/{id}/movements
POST   /api/v1/banks/{id}/movements
POST   /api/v1/banks/{id}/import-statement    -- Importar extracto
GET    /api/v1/banks/{id}/reconciliation
POST   /api/v1/banks/{id}/reconciliation
GET    /api/v1/cash-flow
GET    /api/v1/cash-flow/projection
```

---

### FASE 4: MICROSERVICIO DE NÓMINA (5-7 días)
**Objetivo**: Gestión de nómina con prestaciones colombianas

#### 4.1 Estructura
```
/app/services/payroll/
├── main.py
├── models/
│   ├── employee.py
│   ├── contract.py
│   ├── payroll.py
│   ├── payroll_item.py
│   └── novelty.py
├── services/
│   ├── employee_service.py
│   ├── payroll_service.py
│   ├── benefits_service.py    # Prestaciones sociales
│   ├── contributions_service.py # Aportes parafiscales
│   └── dian_ne_service.py     # Nómina electrónica (preparado)
├── routers/
│   ├── employees.py
│   ├── contracts.py
│   ├── payroll.py
│   └── novelties.py
├── utils/
│   ├── colombian_labor.py     # Cálculos laborales CO
│   └── uvt.py                 # Valores UVT
└── requirements.txt
```

#### 4.2 Modelo de Datos - Nómina
```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    third_party_id UUID REFERENCES third_parties(id),
    employee_code VARCHAR(20) UNIQUE,
    hire_date DATE NOT NULL,
    termination_date DATE,
    department VARCHAR(100),
    position VARCHAR(100),
    
    -- Tipo de contrato
    contract_type VARCHAR(30) NOT NULL,   -- INDEFINIDO, FIJO, OBRA_LABOR, PRESTACION_SERVICIOS
    contract_end_date DATE,
    
    -- Salario
    base_salary NUMERIC(20,2) NOT NULL,
    salary_type VARCHAR(20) DEFAULT 'FIJO', -- FIJO, VARIABLE, INTEGRAL
    payment_frequency VARCHAR(20) DEFAULT 'QUINCENAL', -- QUINCENAL, MENSUAL
    
    -- Seguridad social
    eps_code VARCHAR(10),
    pension_fund_code VARCHAR(10),
    arl_code VARCHAR(10),
    arl_risk_level INTEGER DEFAULT 1,     -- 1 a 5
    cesantias_fund_code VARCHAR(10),
    
    -- Deducciones fijas
    has_transportation_allowance BOOLEAN DEFAULT TRUE,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    period INTEGER NOT NULL,              -- 1 o 2 (quincena)
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payment_date DATE,
    status VARCHAR(20) DEFAULT 'DRAFT',   -- DRAFT, CALCULATED, APPROVED, PAID
    total_earnings NUMERIC(20,2) DEFAULT 0,
    total_deductions NUMERIC(20,2) DEFAULT 0,
    total_employer_cost NUMERIC(20,2) DEFAULT 0,
    total_net_pay NUMERIC(20,2) DEFAULT 0,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payroll_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_period_id UUID REFERENCES payroll_periods(id),
    employee_id UUID REFERENCES employees(id),
    
    -- Días trabajados
    worked_days NUMERIC(5,2) DEFAULT 15,
    
    -- Devengados
    base_salary NUMERIC(20,2),
    transportation_allowance NUMERIC(20,2),
    overtime_hours NUMERIC(10,2) DEFAULT 0,
    overtime_amount NUMERIC(20,2) DEFAULT 0,
    commissions NUMERIC(20,2) DEFAULT 0,
    bonuses NUMERIC(20,2) DEFAULT 0,
    other_earnings NUMERIC(20,2) DEFAULT 0,
    total_earnings NUMERIC(20,2),
    
    -- Deducciones empleado
    health_contribution NUMERIC(20,2),     -- 4% salud
    pension_contribution NUMERIC(20,2),    -- 4% pensión
    solidarity_fund NUMERIC(20,2),         -- >4 SMLV
    retention_source NUMERIC(20,2),        -- Retefuente
    other_deductions NUMERIC(20,2) DEFAULT 0,
    total_deductions NUMERIC(20,2),
    
    -- Aportes empleador
    employer_health NUMERIC(20,2),         -- 8.5%
    employer_pension NUMERIC(20,2),        -- 12%
    arl NUMERIC(20,2),                     -- Según riesgo
    sena NUMERIC(20,2),                    -- 2%
    icbf NUMERIC(20,2),                    -- 3%
    caja_compensacion NUMERIC(20,2),       -- 4%
    total_employer_cost NUMERIC(20,2),
    
    -- Provisiones
    provision_cesantias NUMERIC(20,2),     -- 8.33%
    provision_int_cesantias NUMERIC(20,2), -- 1%
    provision_prima NUMERIC(20,2),         -- 8.33%
    provision_vacaciones NUMERIC(20,2),    -- 4.17%
    
    net_pay NUMERIC(20,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payroll_novelties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id),
    payroll_period_id UUID REFERENCES payroll_periods(id),
    type VARCHAR(50) NOT NULL,            -- INCAPACIDAD, LICENCIA, VACACIONES, AUSENCIA, HORA_EXTRA
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days NUMERIC(5,2),
    hours NUMERIC(10,2),
    amount NUMERIC(20,2),
    description TEXT,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.3 Endpoints Nómina
```
GET    /api/v1/employees
POST   /api/v1/employees
GET    /api/v1/employees/{id}
PUT    /api/v1/employees/{id}

GET    /api/v1/payroll/periods
POST   /api/v1/payroll/periods
GET    /api/v1/payroll/periods/{id}
POST   /api/v1/payroll/periods/{id}/calculate
POST   /api/v1/payroll/periods/{id}/approve
GET    /api/v1/payroll/periods/{id}/payslips
GET    /api/v1/payroll/periods/{id}/payslip/{employee_id}/pdf

GET    /api/v1/payroll/novelties
POST   /api/v1/payroll/novelties

GET    /api/v1/payroll/reports/pila        # Planilla PILA
GET    /api/v1/payroll/reports/certificates # Certificados
```

#### 4.4 Cálculos Laborales Colombia 2025
```python
# /app/services/payroll/utils/colombian_labor.py

SMLV_2025 = 1_423_500  # Salario mínimo 2025
AUXILIO_TRANSPORTE_2025 = 200_000  # Auxilio transporte 2025
UVT_2025 = 49_799  # Unidad de Valor Tributario 2025

# Aportes empleado
SALUD_EMPLEADO = 0.04      # 4%
PENSION_EMPLEADO = 0.04    # 4%

# Aportes empleador
SALUD_EMPLEADOR = 0.085    # 8.5%
PENSION_EMPLEADOR = 0.12   # 12%
SENA = 0.02                # 2%
ICBF = 0.03                # 3%
CAJA_COMPENSACION = 0.04   # 4%

# ARL según nivel de riesgo
ARL_TASAS = {
    1: 0.00522,  # 0.522%
    2: 0.01044,  # 1.044%
    3: 0.02436,  # 2.436%
    4: 0.04350,  # 4.35%
    5: 0.06960,  # 6.96%
}

# Prestaciones
CESANTIAS = 0.0833         # 8.33%
INT_CESANTIAS = 0.01       # 1%
PRIMA = 0.0833             # 8.33%
VACACIONES = 0.0417        # 4.17%

# Horas extra
HORA_EXTRA_DIURNA = 1.25   # 25%
HORA_EXTRA_NOCTURNA = 1.75 # 75%
HORA_EXTRA_DOMINICAL = 2.0 # 100%
HORA_EXTRA_DOMINICAL_NOCTURNA = 2.5 # 150%
```

---

### FASE 5: CARTERA Y CUENTAS POR COBRAR/PAGAR (2-3 días)
**Objetivo**: Gestión de cartera con edad y provisiones

#### 5.1 Modelo de Datos
```sql
CREATE TABLE receivables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    third_party_id UUID REFERENCES third_parties(id),
    invoice_id UUID REFERENCES invoices(id),
    document_type VARCHAR(20) NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    original_amount NUMERIC(20,2) NOT NULL,
    paid_amount NUMERIC(20,2) DEFAULT 0,
    balance NUMERIC(20,2) NOT NULL,
    days_overdue INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PARTIAL, PAID, WRITTEN_OFF
    provision_amount NUMERIC(20,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE receivable_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receivable_id UUID REFERENCES receivables(id),
    payment_date DATE NOT NULL,
    amount NUMERIC(20,2) NOT NULL,
    payment_method VARCHAR(30),
    reference VARCHAR(100),
    bank_account_id UUID REFERENCES bank_accounts(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vista de edad de cartera
CREATE VIEW receivables_aging AS
SELECT 
    r.*,
    tp.full_name as third_party_name,
    CASE 
        WHEN r.days_overdue <= 0 THEN 'current'
        WHEN r.days_overdue <= 30 THEN '1-30'
        WHEN r.days_overdue <= 60 THEN '31-60'
        WHEN r.days_overdue <= 90 THEN '61-90'
        WHEN r.days_overdue <= 180 THEN '91-180'
        ELSE '180+'
    END as aging_bucket
FROM receivables r
JOIN third_parties tp ON r.third_party_id = tp.id
WHERE r.status != 'PAID';
```

#### 5.2 Endpoints Cartera
```
GET    /api/v1/receivables
GET    /api/v1/receivables/aging
GET    /api/v1/receivables/by-customer/{id}
POST   /api/v1/receivables/{id}/payment
POST   /api/v1/receivables/{id}/write-off

GET    /api/v1/payables
GET    /api/v1/payables/aging
GET    /api/v1/payables/by-supplier/{id}
POST   /api/v1/payables/{id}/payment

GET    /api/v1/reports/accounts-receivable
GET    /api/v1/reports/accounts-payable
GET    /api/v1/reports/cash-flow-projection
```

---

### FASE 6: INFORMES DIAN Y EXÓGENA (3-4 días)
**Objetivo**: Generación de informes tributarios

#### 6.1 Formatos a Implementar
```
Formato 1001 - Pagos a terceros
Formato 1003 - Retenciones en la fuente
Formato 1005 - IVA descontable
Formato 1006 - IVA generado
Formato 1007 - Ingresos recibidos
Formato 1008 - Cuentas por cobrar
Formato 1009 - Cuentas por pagar
Formato 1011 - Información de socios
```

#### 6.2 Endpoints Informes DIAN
```
GET    /api/v1/dian/exogena/formats
GET    /api/v1/dian/exogena/{format_code}/preview
GET    /api/v1/dian/exogena/{format_code}/xml
GET    /api/v1/dian/exogena/{format_code}/excel
POST   /api/v1/dian/exogena/validate

GET    /api/v1/dian/iva-return/preview
GET    /api/v1/dian/retention-return/preview
```

---

### FASE 7: CIERRE CONTABLE (2-3 días)
**Objetivo**: Proceso de cierre mensual y anual

#### 7.1 Funcionalidades
```
- Cierre mensual (bloqueo de período)
- Cierre anual (traslado de utilidad/pérdida)
- Generación de asientos de ajuste
- Reversión de cierre
- Validaciones pre-cierre
```

#### 7.2 Endpoints Cierre
```
GET    /api/v1/closing/periods
POST   /api/v1/closing/monthly/{year}/{month}
POST   /api/v1/closing/annual/{year}
POST   /api/v1/closing/{id}/reverse
GET    /api/v1/closing/pre-check/{year}/{month}
```

---

### FASE 8: INTEGRACIÓN Y FRONTEND (3-5 días)
**Objetivo**: Actualizar frontend para consumir microservicios

#### 8.1 Tareas
- [ ] Crear API Gateway en Next.js
- [ ] Actualizar Server Actions para llamar microservicios
- [ ] Implementar nuevas páginas UI:
  - [ ] /empleados - Gestión de empleados
  - [ ] /nomina - Liquidación de nómina
  - [ ] /bancos - Cuentas bancarias
  - [ ] /cartera - Edad de cartera
  - [ ] /dian - Informes tributarios
  - [ ] /cierre - Cierre contable

---

## 📁 ESTRUCTURA FINAL DEL PROYECTO

```
/app/
├── frontend/                    # Next.js Frontend
│   └── src/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── services/           # API clients para microservicios
│
├── services/                    # Microservicios Backend
│   ├── accounting/             # Puerto 8002
│   │   ├── main.py
│   │   ├── models/
│   │   ├── services/
│   │   └── routers/
│   │
│   ├── billing/                # Puerto 8003
│   │   ├── main.py
│   │   ├── models/
│   │   ├── services/
│   │   └── routers/
│   │
│   ├── treasury/               # Puerto 8004
│   │   ├── main.py
│   │   ├── models/
│   │   ├── services/
│   │   └── routers/
│   │
│   ├── payroll/                # Puerto 8005
│   │   ├── main.py
│   │   ├── models/
│   │   ├── services/
│   │   └── routers/
│   │
│   ├── ai/                     # Puerto 8001 (actual)
│   │   └── main.py             # DigiCFO Chat
│   │
│   └── shared/                 # Código compartido
│       ├── database.py
│       ├── auth.py
│       └── utils/
│
├── docker-compose.yml          # Orquestación de servicios
├── supabase/
│   └── migrations/
└── README.md
```

---

## 🧪 PLAN DE TESTING

### Por cada fase:
1. **Unit Tests**: Lógica de negocio
2. **Integration Tests**: Endpoints API
3. **E2E Tests**: Flujos completos

### Herramientas:
- pytest (Backend)
- Playwright (Frontend E2E)
- Postman/curl (API manual)

---

## 📊 CRONOGRAMA ESTIMADO

| Fase | Descripción | Duración | Acumulado |
|------|-------------|----------|----------|
| 0 | Preparación | 1-2 días | 2 días |
| 1 | Microservicio Contabilidad | 3-5 días | 7 días |
| 2 | Microservicio Facturación | 5-7 días | 14 días |
| 3 | Microservicio Tesorería | 3-4 días | 18 días |
| 4 | Microservicio Nómina | 5-7 días | 25 días |
| 5 | Cartera | 2-3 días | 28 días |
| 6 | Informes DIAN | 3-4 días | 32 días |
| 7 | Cierre Contable | 2-3 días | 35 días |
| 8 | Integración Frontend | 3-5 días | 40 días |

**Total estimado: 6-8 semanas**

---

## ✅ CHECKLIST DE VALIDACIÓN

### Antes de producción:
- [ ] Todos los microservicios corriendo
- [ ] Migraciones ejecutadas en Supabase
- [ ] Tests pasando al 100%
- [ ] Cálculos tributarios validados con contador
- [ ] Formatos DIAN validados
- [ ] Backup y recuperación probados
- [ ] Documentación API completa
- [ ] Capacitación usuarios

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

1. **Hoy**: Ejecutar Fase 0 (migraciones pendientes)
2. **Mañana**: Iniciar Fase 1 (crear estructura microservicio contabilidad)
3. **Esta semana**: Completar Fases 0-1

¿Deseas que comience con la Fase 0?
