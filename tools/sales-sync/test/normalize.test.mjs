import test from 'node:test';
import assert from 'node:assert/strict';
import { matchHeader, normalizeSeniority, normalizeUnit, toISODate, toNumber, toPercent } from '../lib/normalize.mjs';

// Encabezados tomados literalmente de los modelos financieros reales de HPlus.
// Si alguno deja de mapear, la ingesta se rompe en silencio: de ahí las pruebas.
test('mapea los encabezados de la tabla de tarifas', () => {
    assert.equal(matchHeader('Rol'), 'role_family');
    assert.equal(matchHeader('Horas'), 'hours');
    assert.equal(matchHeader('Tarifa venta\n(COP/h)'), 'unit_price');
    assert.equal(matchHeader('Costo interno\n(COP/h)'), 'unit_direct_cost');
    assert.equal(matchHeader('Subtotal (COP)'), 'total');
});

test('distingue tarifa base de tarifa ajustada', () => {
    // Si ambas cayeran en unit_price se perdería el descuento negociado.
    assert.equal(matchHeader('Tarifa base\n(COP/h)'), 'unit_list_price');
    assert.equal(matchHeader('Tarifa ajustada\n(COP/h)'), 'unit_price');
});

test('separa el costo unitario del monto total de costo', () => {
    // "Costo directo (COP)" es un monto por rol, no una tarifa horaria:
    // leerlo como costo unitario daría un margen absurdo.
    assert.equal(matchHeader('Costo interno (COP/h)'), 'unit_direct_cost');
    assert.equal(matchHeader('Costo directo (COP)'), 'total_cost');
    assert.equal(matchHeader('Costo mensual\ntotal c/persona (COP)'), 'unit_direct_cost');
    assert.equal(matchHeader('Costo total\nrol (COP)'), 'total_cost');
});

test('entiende los modelos que costean por dedicación mensual', () => {
    assert.equal(matchHeader('Headcount'), 'quantity');
    assert.equal(matchHeader('Persona-\nmeses'), 'quantity');
});

test('no mapea encabezados genéricos ni ajenos a la tabla', () => {
    // "Valor" no es evidencia suficiente de "valor unitario": mapearlo hacía
    // que una hoja de supuestos ganara a la tabla de precios.
    assert.equal(matchHeader('Valor'), null);
    assert.equal(matchHeader('Parámetro'), null);
    assert.equal(matchHeader('Nota / Fuente'), null);
    assert.equal(matchHeader('Salario base anual (USD)'), null);
    assert.equal(matchHeader('FTE Año 2'), null);
});

test('lee números en formato colombiano', () => {
    assert.equal(toNumber('$ 1.234.567,89'), 1234567.89);
    assert.equal(toNumber('1,234,567.89'), 1234567.89);
    assert.equal(toNumber('(1.500)'), -1500);
    assert.equal(toNumber('160000'), 160000);
    assert.equal(toNumber(''), null);
    assert.equal(toNumber('n/a'), null);
});

test('normaliza porcentajes vengan como fracción o como entero', () => {
    assert.equal(toPercent(0.19), 19);
    assert.equal(toPercent('19%'), 19);
    assert.equal(toPercent(19), 19);
});

test('interpreta fechas en los formatos usuales', () => {
    assert.equal(toISODate('2026-03-14'), '2026-03-14');
    assert.equal(toISODate('14/03/2026'), '2026-03-14');
    assert.equal(toISODate('20260314'), '2026-03-14');
    assert.equal(toISODate('no es fecha'), null);
});

test('deduce el nivel desde el nombre del rol', () => {
    assert.equal(normalizeSeniority('Backend Developer Senior (Node/TS)'), 'SENIOR');
    assert.equal(normalizeSeniority('Arquitecto de Soluciones AI (Principal)'), 'PRINCIPAL');
    assert.equal(normalizeSeniority('Desarrollador Semi Senior'), 'SEMISENIOR');
    assert.equal(normalizeSeniority('QA Engineer'), null);
});

test('normaliza unidades de medida', () => {
    assert.equal(normalizeUnit('Hora'), 'HORA');
    assert.equal(normalizeUnit('Mes'), 'MES');
    assert.equal(normalizeUnit('Sprint'), 'SPRINT');
    assert.equal(normalizeUnit('cualquier cosa'), null);
});
