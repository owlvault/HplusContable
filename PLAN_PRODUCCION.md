# Plan de Implementación — Contabilidad de Empresa Real

Objetivo: llevar **DigiKawsay / HplusContable** desde su MVP a un sistema con el
que una empresa colombiana real pueda llevar su contabilidad de forma legal,
completa y auditable.

## Estado de ejecución

| Fase | Alcance | Estado |
|------|---------|--------|
| **0** | Datos maestros (CRUD PUC/Terceros), config de empresa, RLS | ✅ Implementada |
| **1** | Motor tributario parametrizable (conceptos, tarifas, UVT), retenciones | ✅ Implementada |
| **2** | Facturación electrónica DIAN | ⛔ Excluida por decisión del usuario |
| **3** | Nómina de ley: prestaciones, liquidaciones, PILA, contabilización | ✅ Implementada |
| **4** | Cierre (asiento de cancelación), declaraciones IVA/retención, exógena | ✅ Implementada |
| **5** | Estados NIIF, numeración documental, inmutabilidad, tests, limpieza | ✅ Implementada |

> La Fase 2 (FE-DIAN) queda como stub existente en `src/actions/dian.ts`. Requiere
> un Proveedor Tecnológico autorizado; se retomará cuando el negocio lo decida.

## Convenciones de ejecución
- Server Action nueva → `'use server'`, `enforcePermission(module, action)`,
  validación de dominio, mutación/RPC, auditoría y `revalidatePath`.
- Cambio de esquema → migración numerada nueva en `supabase/migrations/`,
  tipos en `src/types/database.ts`.
- Dinero/impuestos → helpers en `src/lib/utils/` con pruebas `*.test.ts`.
- Invariantes intactas: partida doble (`|débito−crédito| ≤ 0,01`),
  estados `BORRADOR→APROBADO→ANULADO`, tarifas/cuentas parametrizadas.

## Migraciones añadidas
- `0003_fase0_master_data_company.sql` — régimen de terceros + `company_settings`.
- `0004_fase1_tax_engine.sql` — `tax_concepts`, `uvt_values`, tarifas por concepto.
- `0005_fase3_payroll_prestaciones.sql` — prestaciones, liquidaciones, PILA.
- `0006_fase4_closing_tax_reports.sql` — cierre anual, declaraciones, exógena.
- `0007_fase5_document_sequences_immutability.sql` — consecutivos e inmutabilidad.

## Decisiones pendientes del negocio
1. **Proveedor de facturación electrónica** (Fase 2) cuando se retome.
2. **Alcance NIIF**: plenas o PYMES (afecta notas y formatos de estados).
3. **Multiempresa**: hoy es monoempresa por diseño (`company_settings` singleton).
