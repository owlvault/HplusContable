# DigiKawsay - PRD (Product Requirements Document)

## Descripción General
DigiKawsay (HplusContable) es un software contable SaaS para Colombia, diseñado para una sola empresa con arquitectura modular monolítica.

## Estado Actual: MVP COMPLETO + MEJORAS UX - Listo para Despliegue

### Funcionalidades Implementadas

#### Core Accounting
- ✅ PUC (Plan Único de Cuentas) - CRUD completo
- ✅ Terceros (Clientes/Proveedores/Empleados) - CRUD completo
- ✅ Asientos Contables - Creación con partida doble
- ✅ Comprobantes 
- ✅ DigiCFO (Chatbot AI conectado a datos reales de Supabase)

#### Módulo de Facturación
- ✅ CRUD de facturas de venta (FV) y compra (FC)
- ✅ Cálculo automático de IVA (0%, 5%, 19%)
- ✅ Manejo de retenciones (Fuente, IVA, ICA)
- ✅ Contabilización automática al aprobar
- ✅ Generación de PDF de facturas
- ✅ **NUEVO**: Transacciones atómicas via RPC para consecutivos

#### Módulo de Cartera
- ✅ Cuentas por Cobrar/Pagar automáticas
- ✅ Tabla de Antigüedad de Cartera
- ✅ Alertas de vencimiento

#### Módulo de Tesorería
- ✅ Gestión de cuentas bancarias
- ✅ Registro de movimientos bancarios

#### Módulo de Reportes Financieros
- ✅ Cartera por Clientes/Proveedores
- ✅ Balance de Comprobación
- ✅ Balance General
- ✅ Estado de Resultados
- ✅ **NUEVO**: Descarga en PDF de todos los reportes

#### Módulo de Cierre Contable
- ✅ Vista de 12 meses con estados
- ✅ Validación de período
- ✅ Cierre/Reapertura/Bloqueo
- ✅ **NUEVO**: Diálogos modernos shadcn (sin alert/confirm)

### Mejoras UX Implementadas (Julio 2026)
- ✅ **Mensajes de error en español** - Errores de Supabase Auth mapeados
- ✅ **Descarga PDF** - Todos los reportes financieros
- ✅ **Diálogos modernos** - shadcn Dialog y Toast en toda la app
- ✅ **Transacciones atómicas** - RPC para consecutivos de facturas

### Base de Datos (Supabase)
Tablas principales: puc_accounts, third_parties, journal_entries, journal_lines, invoices, invoice_lines, receivables, payables, bank_accounts, bank_movements, accounting_periods, document_sequences

## Arquitectura

### Stack Tecnológico
- **Frontend**: Next.js 15 (App Router, Server Actions, Turbopack)
- **Backend**: FastAPI (solo AI/Chat)
- **Base de Datos**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS 3.4
- **UI Components**: shadcn/ui (Dialog, Toast)
- **PDF**: @react-pdf/renderer

### Estructura de Archivos
```
/app/src/
├── actions/          # Server Actions
├── app/(dashboard)/  # UI Pages
├── components/       # React Components
│   ├── ui/          # shadcn components
│   └── reportes/    # Report components + PDFs
├── hooks/           # Custom hooks (use-toast)
└── lib/
    ├── utils.ts     # cn() utility
    ├── error-messages.ts  # Spanish error mapper
    └── utils/       # Invoice calculations
```

## Credenciales de Prueba
- Email: admin@digikawsay.app
- Password: CalamarDorado9!

## Supabase Project
- URL: https://fitjpyqrecgvlrlpwipn.supabase.co

## Testing Status
- ✅ E2E Testing: 100% (7/7 test cases pass)
- ✅ Tailwind CSS funcionando
- ✅ Server Actions validados
- ✅ PDF generation validado
- ✅ Toast notifications validadas

## Backlog Priorizado

### P2 - Media Prioridad
- [ ] Incluir Utilidad del Ejercicio en Patrimonio del Balance General (actualmente muestra diferencia)
- [ ] Ejecutar RPC `get_next_invoice_number` en Supabase Dashboard

### P3 - Baja Prioridad (Futuro)
- [ ] Módulo de Nómina
- [ ] Integración Facturación Electrónica DIAN
- [ ] Reportes de Información Exógena
- [ ] Control de acceso basado en roles (RBAC)

## Changelog

### 2026-07-20
- Implementados mensajes de error en español para login
- Agregado descarga PDF para todos los reportes financieros
- Reemplazados alert/confirm con shadcn Dialog y Toast
- Creada función RPC para transacciones atómicas en facturas
- Testing E2E: 100% pass rate
