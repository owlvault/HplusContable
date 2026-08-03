# PRODUCT REQUIREMENTS DOCUMENT: CONTABLE (CFO-IA)

## 1. Visión General

Contable ejecuta la estrategia financiera de H Plus. Minimiza la fricción en la captura de datos y maximiza la visibilidad de la salud financiera en tiempo real, operando como un agente de control que previene errores humanos y asegura el cumplimiento normativo.

## 2. Adquisición de Datos (Fricción Cero)

El sistema debe abstraer la complejidad contable del usuario final.

- **Ingesta Multimodal:** Soporte para carga de recibos (PDF/Imágenes) vía endpoint unificado.
- **Extracción NLP:** Capacidad de procesar instrucciones en lenguaje natural (ej. "Pagué 150.000 COP en transporte para la reunión de preventa con el cliente X").
- **Validación Inmediata:** El sistema extrae [Monto], [Concepto], [Tercero], pre-calcula los impuestos según el motor fiscal y solicita confirmación de un solo clic al usuario.

## 3. Ejecución de la Estrategia (Módulo Analítico)

- **Monitor de Liquidez en Tiempo Real:** Cálculo dinámico de cuentas por cobrar (cartera), cuentas por pagar y flujo de caja libre, actualizado con cada evento transaccional.
- **Detección de Anomalías:** Implementación de pipelines analíticos (TDA / Machine Learning ligero) para identificar pagos duplicados, desviaciones presupuestales fuera de la varianza histórica o comportamientos atípicos en la facturación.
- **Alineación con OKRs:** Integración del presupuesto operativo contra el gasto ejecutado, emitiendo alertas cuando un centro de costos se acerque al límite establecido para el trimestre.

## 4. Interacción y Red de Compromisos (Framework MAP)

Contable opera como un actor en la red de compromisos de H Plus:

- **Peticiones Autónomas:** Si detecta un movimiento bancario sin soporte, el CFO-IA emite una solicitud directa al responsable ("Falta factura para el cargo de $X en la tarjeta corporativa").
- **Seguimiento:** Mantiene el estado de las solicitudes pendientes (abiertas, negociadas, cumplidas) y escala si no se resuelven en los tiempos de ciclo definidos.

## 5. Requerimientos No Funcionales (Calidad de Datos)

- **Partida Doble Garantizada:** Bloqueo a nivel de base de datos de cualquier asiento que no cuadre (Suma Débitos = Suma Créditos).
- **Trazabilidad de Auditoría (Audit Trail):** Cada registro insertado, modificado o eliminado (soft delete) debe conservar el ID del usuario humano o el identificador del Agente IA que ejecutó la acción, junto con el timestamp exacto.
