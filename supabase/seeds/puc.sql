
-- PUC INITIAL SEED (Reduced version)
-- Class 1: ACTIVO
INSERT INTO puc_accounts (code, name, type, nature, level, parent_code) VALUES
('1', 'ACTIVO', 'ACTIVO', 'DEBITO', 1, NULL),
('11', 'DISPONIBLE', 'ACTIVO', 'DEBITO', 2, '1'),
('1105', 'CAJA', 'ACTIVO', 'DEBITO', 4, '11'),
('110505', 'CAJA GENERAL', 'ACTIVO', 'DEBITO', 6, '1105'),
('1110', 'BANCOS', 'ACTIVO', 'DEBITO', 4, '11'),
('111005', 'MONEDA NACIONAL', 'ACTIVO', 'DEBITO', 6, '1110'),
('13', 'DEUDORES', 'ACTIVO', 'DEBITO', 2, '1'),
('1305', 'CLIENTES', 'ACTIVO', 'DEBITO', 4, '13'),
('15', 'PROPIEDAD PLANTA Y EQUIPO', 'ACTIVO', 'DEBITO', 2, '1');

-- Class 2: PASIVO
INSERT INTO puc_accounts (code, name, type, nature, level, parent_code) VALUES
('2', 'PASIVO', 'PASIVO', 'CREDITO', 1, NULL),
('22', 'PROVEEDORES', 'PASIVO', 'CREDITO', 2, '2'),
('2205', 'NACIONALES', 'PASIVO', 'CREDITO', 4, '22'),
('23', 'CUENTAS POR PAGAR', 'PASIVO', 'CREDITO', 2, '2'),
('24', 'IMPUESTOS GRAVAMENES Y TASAS', 'PASIVO', 'CREDITO', 2, '2');

-- Class 3: PATRIMONIO
INSERT INTO puc_accounts (code, name, type, nature, level, parent_code) VALUES
('3', 'PATRIMONIO', 'PATRIMONIO', 'CREDITO', 1, NULL),
('31', 'CAPITAL SOCIAL', 'PATRIMONIO', 'CREDITO', 2, '3');

-- Class 4: INGRESOS
INSERT INTO puc_accounts (code, name, type, nature, level, parent_code) VALUES
('4', 'INGRESOS', 'INGRESO', 'CREDITO', 1, NULL),
('41', 'OPERACIONALES', 'INGRESO', 'CREDITO', 2, '4'),
('4135', 'COMERCIO AL POR MAYOR Y AL POR MENOR', 'INGRESO', 'CREDITO', 4, '41');

-- Class 5: GASTOS
INSERT INTO puc_accounts (code, name, type, nature, level, parent_code) VALUES
('5', 'GASTOS', 'GASTO', 'DEBITO', 1, NULL),
('51', 'OPERACIONALES DE ADMINISTRACION', 'GASTO', 'DEBITO', 2, '5'),
('5105', 'GASTOS DE PERSONAL', 'GASTO', 'DEBITO', 4, '51');

-- Class 6: COSTOS DE VENTAS
INSERT INTO puc_accounts (code, name, type, nature, level, parent_code) VALUES
('6', 'COSTOS DE VENTAS', 'COSTO_VENTAS', 'DEBITO', 1, NULL),
('61', 'COSTO DE VENTAS Y DE PRESTACION DE SERVICIOS', 'COSTO_VENTAS', 'DEBITO', 2, '6');
