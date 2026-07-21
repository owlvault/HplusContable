# DigiKawsay - PRD (Product Requirements Document)

## Descripción General
DigiKawsay (HplusContable) es un software contable SaaS para Colombia, diseñado para una sola empresa con arquitectura modular monolítica.

## Estado Actual: MVP COMPLETO + MÓDULOS AVANZADOS - Listo para Despliegue

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
- ✅ Transacciones atómicas via RPC para consecutivos

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
- ✅ Descarga en PDF de todos los reportes

#### Módulo de Cierre Contable
- ✅ Vista de 12 meses con estados
- ✅ Validación de período
- ✅ Cierre/Reapertura/Bloqueo
- ✅ Diálogos modernos shadcn (sin alert/confirm)

#### 🆕 Módulo de Usuarios y Roles (RBAC) - NUEVO
- ✅ Gestión de roles (Administrador, Contador, Auxiliar Contable, Consulta)
- ✅ Matriz de permisos por módulo (Leer, Escribir, Eliminar, Aprobar)
- ✅ Roles de sistema protegidos (no editables/eliminables)
- ✅ Creación de roles personalizados

#### 🆕 Módulo de Plantillas de Factura - NUEVO
- ✅ Configuración de información de empresa (Nombre, NIT, Dirección, etc.)
- ✅ Personalización de colores corporativos
- ✅ Plantilla estándar por defecto
- ✅ Soporte para múltiples plantillas

#### 🆕 Módulo de Conciliación Bancaria - NUEVO
- ✅ Selector de cuenta bancaria
- ✅ Carga de extractos bancarios
- ✅ Comparación de movimientos registrados vs extracto
- ✅ Estados de conciliación (Pendiente, Conciliado, Manual, Excluido)

### Mejoras UX Implementadas (Julio 2026)
- ✅ **Mensajes de error en español** - Errores de Supabase Auth mapeados
- ✅ **Descarga PDF** - Todos los reportes financieros
- ✅ **Diálogos modernos** - shadcn Dialog y Toast en toda la app
- ✅ **Transacciones atómicas** - RPC para consecutivos de facturas

### Base de Datos (Supabase)
Tablas principales: 
- **Core**: puc_accounts, third_parties, journal_entries, journal_lines
- **Facturación**: invoices, invoice_lines, document_sequences
- **Cartera**: receivables, payables
- **Tesorería**: bank_accounts, bank_movements
- **Cierre**: accounting_periods
- **🆕 Roles**: user_roles, role_permissions, user_role_assignments
- **🆕 Plantillas**: invoice_templates
- **🆕 Conciliación**: bank_statements, bank_statement_lines

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

### P1 - Alta Prioridad
- [ ] Implementar validaciones RBAC en todos los Server Actions existentes

### P2 - Media Prioridad
- [ ] Incluir Utilidad del Ejercicio en Patrimonio del Balance General

### P3 - Baja Prioridad (Futuro)
- [ ] Módulo de Nómina (alta complejidad por legislación colombiana)
- [ ] Integración Facturación Electrónica DIAN
- [ ] Reportes de Información Exógena

## Changelog

### 2026-07-21
- ✅ **Ejecutados schemas SQL** para nuevos módulos en Supabase
- ✅ **Corregidas políticas RLS** para user_roles, role_permissions, invoice_templates, bank_statements
- ✅ **Configurado CORS** para Server Actions (allowedOrigins actualizado)
- ✅ Verificado funcionamiento de módulo Usuarios/Roles
- ✅ Verificado funcionamiento de módulo Plantillas de Factura
- ✅ Verificado funcionamiento de módulo Conciliación Bancaria

### 2026-07-20
- Implementados mensajes de error en español para login
- Agregado descarga PDF para todos los reportes financieros
- Reemplazados alert/confirm con shadcn Dialog y Toast
- Creada función RPC para transacciones atómicas en facturas
- Testing E2E: 100% pass rate
- Creado código UI y Actions para Roles, Plantillas y Conciliación
