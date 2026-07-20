# DigiKawsay - PRD (Product Requirements Document)

## Descripción General
DigiKawsay (HplusContable) es un software contable SaaS para Colombia, diseñado para una sola empresa con arquitectura modular monolítica.

## Estado Actual: MVP COMPLETO - Listo para Despliegue

### Funcionalidades Implementadas

#### Core Accounting (Previo)
- ✅ PUC (Plan Único de Cuentas) - CRUD completo
- ✅ Terceros (Clientes/Proveedores/Empleados) - CRUD completo
- ✅ Asientos Contables - Creación con partida doble
- ✅ Comprobantes 
- ✅ DigiCFO (Chatbot AI conectado a datos reales de Supabase)

#### Módulo de Facturación (Fase 2) - Completado
- ✅ CRUD de facturas de venta (FV) y compra (FC)
- ✅ Cálculo automático de IVA (0%, 5%, 19%)
- ✅ Manejo de retenciones (Fuente, IVA, ICA)
- ✅ Estados de factura (DRAFT, APPROVED, SENT, PAID, CANCELLED)
- ✅ Consecutivos automáticos por prefijo
- ✅ Vista de detalle con impresión
- ✅ Dashboard con estadísticas
- ✅ **Contabilización automática** al aprobar (genera asiento contable)
- ✅ **Generación de PDF** de facturas (@react-pdf/renderer)

#### Módulo de Cartera (Fase 5) - Completado
- ✅ Cuentas por Cobrar con creación automática al aprobar factura de venta
- ✅ Cuentas por Pagar con creación automática al aprobar factura de compra
- ✅ **Tabla de Antigüedad de Cartera** (Corriente, 1-30, 31-60, 61-90, +90 días)
- ✅ Registro de pagos parciales/totales
- ✅ **Alertas de vencimiento** (código de colores por severidad)
- ✅ Dashboard con estadísticas

#### Módulo de Tesorería (Fase 3) - Completado
- ✅ Gestión de cuentas bancarias
- ✅ Registro de movimientos bancarios
- ✅ Saldos en tiempo real

#### Módulo de Reportes Financieros - Completado
- ✅ **Cartera por Clientes** - Cuentas por cobrar agrupadas
- ✅ **Cartera por Proveedores** - Cuentas por pagar agrupadas
- ✅ **Balance de Comprobación** - Sumas y saldos de todas las cuentas
- ✅ **Balance General** - Estado de Situación Financiera
- ✅ **Estado de Resultados** - Ingresos, gastos y utilidad del período
- ✅ Funcionalidad de impresión

#### Módulo de Cierre Contable - Completado
- ✅ Vista de 12 meses con estados (OPEN/CLOSED/LOCKED)
- ✅ **Validación de período** antes de cerrar (verifica asientos balanceados, borradores)
- ✅ **Cierre de período** con notas opcionales
- ✅ **Reapertura de período** (si no está bloqueado)
- ✅ **Bloqueo permanente** de período
- ✅ Resumen anual de estados

#### Datos Semilla
- ✅ PUC básico colombiano (51 cuentas)
- ✅ Terceros de prueba (3 clientes, 2 proveedores, 1 mixto)
- ✅ Página de Configuración para inicializar datos (/configuracion)

### Base de Datos (Supabase)
Tablas principales:
- `puc_accounts` - Plan Único de Cuentas
- `third_parties` - Terceros
- `journal_entries` - Asientos contables
- `journal_lines` - Líneas de asientos
- `invoices` - Facturas
- `invoice_lines` - Líneas de factura
- `receivables` - Cuentas por cobrar
- `payables` - Cuentas por pagar
- `receivable_payments` - Pagos recibidos
- `payable_payments` - Pagos realizados
- `document_sequences` - Consecutivos
- `bank_accounts` - Cuentas bancarias
- `bank_movements` - Movimientos bancarios
- `accounting_periods` - Períodos contables (auto-creados)

## Arquitectura

### Stack Tecnológico
- **Frontend**: Next.js 15 (App Router, Server Actions, Turbopack)
- **Backend**: FastAPI (solo AI/Chat)
- **Base de Datos**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS 3.4
- **Icons**: Lucide React
- **PDF**: @react-pdf/renderer

### Estructura de Archivos
```
/app/src/
├── actions/
│   ├── invoices.ts    # Facturación + Contabilización automática
│   ├── cartera.ts     # Cartera (CxC, CxP, pagos)
│   ├── tesoreria.ts   # Tesorería (Bancos, movimientos)
│   ├── reportes.ts    # Reportes financieros
│   ├── cierre.ts      # Cierre contable
│   ├── seed.ts        # Datos semilla
│   └── ...
├── app/(dashboard)/
│   ├── facturas/      # Módulo Facturación
│   ├── cartera/       # Módulo Cartera
│   ├── tesoreria/     # Módulo Tesorería
│   ├── reportes/      # Módulo Reportes
│   ├── cierre/        # Módulo Cierre Contable
│   ├── configuracion/ # Inicializar datos
│   └── ...
├── components/
│   ├── facturas/      # invoices-table, invoice-form, invoice-detail, invoice-pdf
│   ├── cartera/       # cartera-stats, aging-table, documents-table, alerts-panel
│   ├── reportes/      # balance-sheet, income-statement, trial-balance, cartera-report
│   └── ...
└── lib/utils/
    └── invoice-calc.ts # Cálculos de totales e IVA
```

## Credenciales de Prueba
- Email: admin@digikawsay.app
- Password: CalamarDorado9!

## Supabase Project
- URL: https://fitjpyqrecgvlrlpwipn.supabase.co

## Testing Status
- ✅ E2E Testing: 100% de flujos pasaron (Login, Dashboard, Reportes, Cierre, Tesorería, Facturas, Cartera)
- ✅ Tailwind CSS configurado y funcionando
- ✅ Server Actions validados

## Backlog Priorizado

### P1 - Alta Prioridad (Data Integrity)
- [ ] Wrap invoice creation en transacción Postgres RPC (race condition en document_sequences)
- [ ] Mejorar manejo de errores en Server Actions (retornar {success, error} en vez de throw)

### P2 - Media Prioridad (UX)
- [ ] Reemplazar alert()/confirm() con shadcn Dialog/Toast
- [ ] Mapear errores de Supabase Auth a mensajes en español

### P3 - Baja Prioridad (Futuro)
- [ ] Módulo de Nómina (alta complejidad por legislación colombiana)
- [ ] Integración con Facturación Electrónica DIAN
- [ ] Reportes de Información Exógena (anuales)
- [ ] Control de acceso basado en roles (RBAC)
