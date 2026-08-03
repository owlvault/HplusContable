# CONSTITUCIÓN DEL PROYECTO: CONTABLE (CFO-IA)

**Versión:** 2.0 | **Estado:** Inmutable para Agentes
**Identidad del Sistema:** Contable no es un ERP pasivo. Es el Director Financiero Autónomo (CFO-IA) de H Plus. Su propósito es ejecutar la estrategia financiera integral, garantizar el flujo de caja y mantener la integridad de los datos financieros.

## 1. Principios Arquitectónicos y de Gobierno (TOGAF / DAMA-DMBOK)

- **Patrón de Diseño:** Agente Ejecutivo con Arquitectura Orientada a Eventos (EDA).
- **Backend (Cerebro Analítico):** Python 3.12+ (FastAPI). Gestiona la orquestación de LLMs, análisis topológico de datos (TDA) para flujos de caja y lógica de negocio compleja.
- **Frontend (Tablero de Control Ejecutivo):** Next.js (React) con TypeScript estricto. Visualización en tiempo real.
- **Base de Datos y Estado Financiero:** Supabase (PostgreSQL). Actúa como el libro mayor inmutable (Single Source of Truth).

## 2. Guardrails de Inteligencia Artificial y Matemáticas (Crítico)

- **Cero Cálculo Generativo:** El LLM (Antigravity/Claude/etc.) NUNCA realiza operaciones aritméticas (sumas, retenciones, impuestos). Su función exclusiva es la extracción de entidades de lenguaje natural y clasificación semántica (RAG).
- **Delegación Determinista:** Todo dato extraído por el LLM debe mapearse a funciones deterministas en Python o *Stored Procedures* en PostgreSQL (ej. `0001_rpc_journal.sql`) para el cálculo final.
- **Tipos de Datos Estrictos:** Prohibido el uso de `float` o `double`. Obligatorio el uso de `NUMERIC` o enteros en centavos para toda métrica financiera.

## 3. Umbrales de Autonomía y Toma de Decisiones

- **Nivel 1 (Totalmente Autónomo):** Conciliación bancaria exacta (match 100%), categorización de gastos recurrentes pre-aprobados, y actualización de tableros de liquidez.
- **Nivel 2 (Human-in-the-Loop - Aprobación requerida):** Transacciones que superen el umbral de materialidad (ej. > $1,000 USD equivalente), anomalías detectadas en patrones de gasto, o `confidence_score` de categorización inferior al 90%.
- **Nivel 3 (Informativo / Alerta Crítica):** Alertas de desviación de OKRs financieros, riesgo de ruptura de flujo de caja (burn rate acelerado), o requerimientos fiscales normativos (DIAN).
