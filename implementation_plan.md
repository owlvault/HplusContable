# Plan de Implementación: HplusContable (DigiKawsay)

## Visión General
Desarrollar una plataforma contable web moderna, escalable y adaptada a la normativa colombiana, con capacidades multiusuario y un asistente financiero basado en IA.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Lenguaje**: TypeScript (Tipado estricto para evitar errores contables)
- **Base de Datos**: PostgreSQL (Supabase recomendado para Auth y RLS)
- **Estilos**: Vanilla CSS (CSS Modules / Variables para temas)
- **IA**: Integration API (OpenAI/Gemini) para análisis de data JSON.

## Fases del Proyecto

### Fase 1: Fundamentos y Configuración
- [ ] Inicializar proyecto Next.js con TypeScript.
- [ ] Configurar estructura de directorios (Clean Architecture).
- [ ] Definir Sistema de Diseño (Variables CSS, Fuentes, Colores Premium).
- [ ] Configurar autenticación base (Login/Registro).

### Fase 2: Núcleo Contable (La "Lógica Colombiana")
- [ ] **Módulo PUC (Plan Único de Cuentas)**:
    - Carga del PUC colombiano oficial.
    - CRUD de cuentas auxiliares.
- [ ] **Módulo de Terceros**:
    - Gestión de Clientes, Proveedores, Empleados.
    - Validación de NIT/Cédula y Dígito de Verificación.
- [ ] **Motor de Asientos (Journal Entry Engine)**:
    - Principio de Partida Doble inmutable.
    - Validación de sumas iguales.

### Fase 3: Operatividad y Regulación
- [ ] Comprobantes Contables (Ingreso, Egreso, Compras, Ventas).
- [ ] Impuestos Automáticos (Retención en la fuente, IVA) basados en tablas configurables.
- [ ] Balance de Prueba y Estado de Resultados básico.

### Fase 4: Inteligencia Artificial (El Asesor Financiero)
- [ ] Dashboard Financiero Inteligente.
- [ ] Chatbot "Asesor": "Analiza mi flujo de caja de este mes".
- [ ] Detección de anomalías en asientos contables.

### Fase 5: Multiusuario y Seguridad
- [ ] Roles y Permisos (Contador vs Auxiliar vs Gerente).
- [ ] Audit Log (Registro de quién modificó qué).

## Estética y UX
- Diseño minimalista, uso de espacios en blanco, tipografía 'Inter' o similar.
- Modo oscuro/claro.
- Micro-interacciones para feedback inmediato al usuario.
