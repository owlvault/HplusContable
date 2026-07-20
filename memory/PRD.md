# DigiKawsay - PRD (Product Requirements Document)

## Descripción General
DigiKawsay (HplusContable) es un software contable SaaS para Colombia, diseñado para una sola empresa con arquitectura modular monolítica.

## Estado Actual: Módulo de Facturación Implementado

### Funcionalidades Implementadas

#### Core Accounting (Previo)
- ✅ PUC (Plan Único de Cuentas) - CRUD completo
- ✅ Terceros (Clientes/Proveedores/Empleados) - CRUD completo
- ✅ Asientos Contables - Creación con partida doble
- ✅ Comprobantes 
- ✅ Reportes básicos
- ✅ DigiCFO (Chatbot AI conectado a datos reales de Supabase)

#### Módulo de Facturación (Fase 2) - Nuevo
- ✅ CRUD de facturas de venta (FV)
- ✅ CRUD de facturas de compra (FC)
- ✅ Cálculo automático de IVA (0%, 5%, 19%)
- ✅ Manejo de retenciones (Fuente, IVA, ICA)
- ✅ Estados de factura (DRAFT, APPROVED, SENT, PAID, CANCELLED)
- ✅ Consecutivos automáticos por prefijo
- ✅ Vista de detalle con impresión
- ✅ Dashboard con estadísticas

### Base de Datos
Todas las tablas creadas en Supabase:
- `invoices` - Facturas
- `invoice_lines` - Líneas de factura
- `credit_notes` - Notas crédito/débito
- `bank_accounts` - Cuentas bancarias
- `bank_movements` - Movimientos bancarios
- `bank_reconciliations` - Conciliaciones
- `receivables` - Cuentas por cobrar
- `payables` - Cuentas por pagar
- `employees` - Empleados
- `payroll_periods` - Períodos de nómina
- `payroll_details` - Detalles de nómina
- `accounting_periods` - Períodos contables
- `document_sequences` - Consecutivos

## Arquitectura

### Stack Tecnológico
- **Frontend**: Next.js 15 (App Router)
- **Backend**: FastAPI (solo AI/Chat)
- **Base de Datos**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS

### Estructura de Archivos
```
/app/
├── src/
│   ├── actions/          # Server Actions
│   │   ├── invoices.ts   # ← NUEVO
│   │   ├── accounting.ts
│   │   ├── third-parties.ts
│   │   └── ...
│   ├── app/(dashboard)/
│   │   ├── facturas/     # ← NUEVO
│   │   │   ├── page.tsx
│   │   │   ├── nueva/page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── ...
│   ├── components/
│   │   ├── facturas/     # ← NUEVO
│   │   │   ├── invoices-table.tsx
│   │   │   ├── invoice-form.tsx
│   │   │   ├── invoice-detail.tsx
│   │   │   └── invoice-stats.tsx
│   │   └── ...
│   └── types/
│       └── invoices.ts   # ← NUEVO
├── backend/
│   └── server.py         # DigiCFO AI
└── .env
```

## Backlog Priorizado

### P0 - Bloqueadores
- [ ] Verificar conectividad con Supabase (DNS resolution issue reportado)

### P1 - Alta Prioridad
- [ ] Implementar RPC de Postgres para transacciones atómicas de facturas
- [ ] Mejorar UX: Reemplazar alert()/prompt() con componentes shadcn/ui

### P2 - Media Prioridad
- [ ] Fase 5: Módulo de Cartera (Cuentas por cobrar/pagar)
- [ ] Fase 3: Módulo de Tesorería (Bancos, conciliación)
- [ ] Contabilización automática de facturas (generar asiento contable)

### P3 - Baja Prioridad
- [ ] Fase 4: Módulo de Nómina
- [ ] Fase 6: Informes DIAN y Exógena
- [ ] Fase 7: Cierre contable

## Credenciales de Prueba
- Email: admin@digikawsay.app
- Password: CalamarDorado9!

## Supabase Project
- URL: https://fitjpyqrecgvlrlpwipn.supabase.co

## Notas Técnicas
- La aplicación usa Next.js Server Actions para operaciones de BD
- Supabase Auth requiere confirmación de email
- RLS (Row Level Security) habilitado en todas las tablas
