# DigiKawsay - PRD (Product Requirements Document)

## Descripción General
DigiKawsay (HplusContable) es un software contable SaaS para Colombia, diseñado para una sola empresa con arquitectura modular monolítica.

## Estado Actual: Módulos de Facturación y Cartera Implementados

### Funcionalidades Implementadas

#### Core Accounting (Previo)
- ✅ PUC (Plan Único de Cuentas) - CRUD completo
- ✅ Terceros (Clientes/Proveedores/Empleados) - CRUD completo
- ✅ Asientos Contables - Creación con partida doble
- ✅ Comprobantes 
- ✅ Reportes básicos
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

#### Módulo de Cartera (Fase 5) - Completado
- ✅ Cuentas por Cobrar con creación automática al aprobar factura de venta
- ✅ Cuentas por Pagar con creación automática al aprobar factura de compra
- ✅ **Tabla de Antigüedad de Cartera** (Corriente, 1-30, 31-60, 61-90, +90 días)
- ✅ Registro de pagos parciales/totales
- ✅ **Alertas de vencimiento** (código de colores por severidad)
- ✅ Dashboard con estadísticas

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

## Arquitectura

### Stack Tecnológico
- **Frontend**: Next.js 15 (App Router)
- **Backend**: FastAPI (solo AI/Chat)
- **Base de Datos**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

### Estructura de Archivos
```
/app/src/
├── actions/
│   ├── invoices.ts    # Facturación + Contabilización automática
│   ├── cartera.ts     # Cartera (CxC, CxP, pagos)
│   ├── seed.ts        # Datos semilla
│   └── ...
├── app/(dashboard)/
│   ├── facturas/      # Módulo Facturación
│   ├── cartera/       # Módulo Cartera
│   ├── configuracion/ # Inicializar datos
│   └── ...
├── components/
│   ├── facturas/      # invoices-table, invoice-form, invoice-detail
│   ├── cartera/       # cartera-stats, aging-table, documents-table, alerts-panel
│   └── ...
└── lib/utils/
    └── invoice-calc.ts # Cálculos de totales e IVA
```

## Credenciales de Prueba
- Email: admin@digikawsay.app
- Password: CalamarDorado9!

## Supabase Project
- URL: https://fitjpyqrecgvlrlpwipn.supabase.co

## Backlog Priorizado

### P1 - Alta Prioridad
- [ ] Fase 3: Módulo de Tesorería (Bancos, conciliación)

### P2 - Media Prioridad
- [ ] Fase 7: Cierre Contable mensual/anual
- [ ] Generación de PDF de facturas
- [ ] Reportes de cartera por tercero

### P3 - Baja Prioridad
- [ ] Fase 4: Módulo de Nómina
- [ ] Fase 6: Informes DIAN y Exógena
