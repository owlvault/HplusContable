# Plan de Implementación: HplusContable (DigiKawsay)

## Visión General
Desarrollar una plataforma contable web moderna, escalable y adaptada a la normativa colombiana, con capacidades multiusuario y un asistente financiero basado en IA.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Lenguaje**: TypeScript (Tipado estricto para evitar errores contables)
- **Base de Datos**: PostgreSQL (Supabase para Auth y RLS)
- **Estilos**: Vanilla CSS (CSS Modules / Variables para temas)
- **IA**: Claude (Anthropic) via Emergent LLM Key para análisis financiero.

## Fases del Proyecto

### Fase 1: Fundamentos y Configuración ✅ COMPLETADO
- [x] Inicializar proyecto Next.js con TypeScript.
- [x] Configurar estructura de directorios (Clean Architecture).
- [x] Definir Sistema de Diseño (Variables CSS, Fuentes, Colores Premium).
- [x] Configurar autenticación base (Login/Registro con Supabase Auth).
- [x] Middleware de protección de rutas.

### Fase 2: Núcleo Contable (La "Lógica Colombiana") ✅ COMPLETADO
- [x] **Módulo PUC (Plan Único de Cuentas)**:
    - Carga del PUC colombiano oficial (seed inicial).
    - CRUD de cuentas auxiliares con formulario modal.
    - Búsqueda y filtrado de cuentas.
- [x] **Módulo de Terceros**:
    - Gestión de Clientes, Proveedores, Empleados.
    - Validación de NIT/Cédula y Dígito de Verificación automático.
    - Filtros por tipo de tercero.
- [x] **Motor de Asientos (Journal Entry Engine)**:
    - Principio de Partida Doble inmutable.
    - Validación de sumas iguales.
    - Selector async de cuentas y terceros.

### Fase 3: Operatividad y Regulación ✅ COMPLETADO
- [x] Comprobantes Contables (Ingreso, Egreso, Compras, Ventas, Nota Contable).
- [x] Impuestos Automáticos (IVA 0%, 5%, 19% y Retención en la fuente).
- [x] Balance de Prueba con validación de cuadratura.
- [x] Estado de Resultados (Ingresos, Costos, Gastos, Utilidad Neta).

### Fase 4: Inteligencia Artificial (El Asesor Financiero) ✅ COMPLETADO
- [x] Dashboard Financiero Inteligente con KPIs.
- [x] Gráfico de Flujo de Caja Mensual.
- [x] Chatbot "DigiCFO": Asesor financiero con Claude (Anthropic).
- [x] Detección de anomalías en asientos contables.

### Fase 5: Multiusuario y Seguridad ✅ COMPLETADO
- [x] Roles y Permisos (ADMIN, CONTADOR, AUXILIAR, GERENTE, VIEWER).
- [x] Sistema de perfiles de usuario.
- [x] Audit Log (Registro de quién modificó qué) - estructura preparada.
- [x] Row Level Security (RLS) en Supabase.

## Estética y UX ✅
- [x] Diseño minimalista, uso de espacios en blanco.
- [x] Tipografía 'Inter' para texto, 'Outfit' para títulos.
- [x] Modo oscuro/claro (auto según preferencias del sistema).
- [x] Colores premium: Navy primario, Emerald acento, Gold para warnings.

## Estructura de Archivos

```
/app
├── .env                          # Credenciales Supabase + Emergent LLM Key
├── /backend                      # API para chat con IA
│   ├── server.py                 # FastAPI + emergentintegrations
│   └── .env                      # EMERGENT_LLM_KEY
├── /src
│   ├── /app
│   │   ├── /(auth)               # Login, Register
│   │   ├── /(dashboard)          # Rutas protegidas
│   │   │   ├── /dashboard        # KPIs + Chat IA + Anomalías
│   │   │   ├── /puc              # Plan de Cuentas
│   │   │   ├── /terceros         # Gestión de Terceros
│   │   │   ├── /asientos         # Asientos Contables
│   │   │   ├── /comprobantes     # Recibos, Facturas, etc.
│   │   │   └── /reportes         # Balance, Estado de Resultados
│   │   └── /api/chat             # Proxy para backend Python
│   ├── /actions                  # Server Actions
│   ├── /components               # Componentes React
│   ├── /lib                      # Supabase clients, utils
│   └── /types                    # TypeScript definitions
└── /supabase
    ├── /migrations               # Schema SQL
    └── /seeds                    # Datos iniciales PUC
```

## Migraciones de Base de Datos

1. `0000_initial_schema.sql` - Tablas base: puc_accounts, third_parties, journal_entries, journal_lines
2. `0001_rpc_journal.sql` - Función RPC para crear asientos transaccionalmente
3. `0002_vouchers_taxes_audit.sql` - Comprobantes, impuestos, audit log, perfiles

## Notas Importantes

- Las migraciones deben ejecutarse en Supabase Dashboard o via CLI
- La autenticación usa cookies HTTP-only via @supabase/ssr
- El chat de IA usa un backend Python separado con emergentintegrations
- Los reportes calculan dinámicamente desde journal_lines
