'use server';

import { createClient } from '@/lib/supabase/server';

// Seed PUC (Plan Único de Cuentas) básico para Colombia
const PUC_ACCOUNTS = [
    // ACTIVOS
    { code: '1', name: 'ACTIVO', type: 'ACTIVO', nature: 'DEBITO', level: 1 },
    { code: '11', name: 'DISPONIBLE', type: 'ACTIVO', nature: 'DEBITO', level: 2, parent_code: '1' },
    { code: '1105', name: 'CAJA', type: 'ACTIVO', nature: 'DEBITO', level: 3, parent_code: '11' },
    { code: '110505', name: 'Caja General', type: 'ACTIVO', nature: 'DEBITO', level: 4, parent_code: '1105' },
    { code: '1110', name: 'BANCOS', type: 'ACTIVO', nature: 'DEBITO', level: 3, parent_code: '11' },
    { code: '111005', name: 'Bancos Nacionales', type: 'ACTIVO', nature: 'DEBITO', level: 4, parent_code: '1110' },
    
    { code: '13', name: 'DEUDORES', type: 'ACTIVO', nature: 'DEBITO', level: 2, parent_code: '1' },
    { code: '1305', name: 'CLIENTES', type: 'ACTIVO', nature: 'DEBITO', level: 3, parent_code: '13' },
    { code: '130505', name: 'Clientes Nacionales', type: 'ACTIVO', nature: 'DEBITO', level: 4, parent_code: '1305' },
    { code: '1355', name: 'ANTICIPO DE IMPUESTOS', type: 'ACTIVO', nature: 'DEBITO', level: 3, parent_code: '13' },
    { code: '135515', name: 'Retención en la Fuente', type: 'ACTIVO', nature: 'DEBITO', level: 4, parent_code: '1355' },
    { code: '135517', name: 'Impuesto a las Ventas Retenido', type: 'ACTIVO', nature: 'DEBITO', level: 4, parent_code: '1355' },
    
    // PASIVOS
    { code: '2', name: 'PASIVO', type: 'PASIVO', nature: 'CREDITO', level: 1 },
    { code: '22', name: 'PROVEEDORES', type: 'PASIVO', nature: 'CREDITO', level: 2, parent_code: '2' },
    { code: '2205', name: 'PROVEEDORES NACIONALES', type: 'PASIVO', nature: 'CREDITO', level: 3, parent_code: '22' },
    { code: '220505', name: 'Proveedores Nacionales', type: 'PASIVO', nature: 'CREDITO', level: 4, parent_code: '2205' },
    
    { code: '23', name: 'CUENTAS POR PAGAR', type: 'PASIVO', nature: 'CREDITO', level: 2, parent_code: '2' },
    { code: '2365', name: 'RETENCIÓN EN LA FUENTE', type: 'PASIVO', nature: 'CREDITO', level: 3, parent_code: '23' },
    { code: '236505', name: 'Retención Salarios', type: 'PASIVO', nature: 'CREDITO', level: 4, parent_code: '2365' },
    { code: '236515', name: 'Retención Honorarios', type: 'PASIVO', nature: 'CREDITO', level: 4, parent_code: '2365' },
    { code: '2367', name: 'IMPUESTO A LAS VENTAS RETENIDO', type: 'PASIVO', nature: 'CREDITO', level: 3, parent_code: '23' },
    { code: '236701', name: 'IVA Retenido', type: 'PASIVO', nature: 'CREDITO', level: 4, parent_code: '2367' },
    { code: '2368', name: 'IMPUESTO DE INDUSTRIA Y COMERCIO RETENIDO', type: 'PASIVO', nature: 'CREDITO', level: 3, parent_code: '23' },
    { code: '236801', name: 'ICA Retenido', type: 'PASIVO', nature: 'CREDITO', level: 4, parent_code: '2368' },
    
    { code: '24', name: 'IMPUESTOS, GRAVÁMENES Y TASAS', type: 'PASIVO', nature: 'CREDITO', level: 2, parent_code: '2' },
    { code: '2408', name: 'IMPUESTO SOBRE LAS VENTAS POR PAGAR', type: 'PASIVO', nature: 'CREDITO', level: 3, parent_code: '24' },
    { code: '240805', name: 'IVA Generado 19%', type: 'PASIVO', nature: 'CREDITO', level: 4, parent_code: '2408' },
    { code: '240810', name: 'IVA Generado 5%', type: 'PASIVO', nature: 'CREDITO', level: 4, parent_code: '2408' },
    
    // PATRIMONIO
    { code: '3', name: 'PATRIMONIO', type: 'PATRIMONIO', nature: 'CREDITO', level: 1 },
    { code: '31', name: 'CAPITAL SOCIAL', type: 'PATRIMONIO', nature: 'CREDITO', level: 2, parent_code: '3' },
    { code: '3105', name: 'CAPITAL SUSCRITO Y PAGADO', type: 'PATRIMONIO', nature: 'CREDITO', level: 3, parent_code: '31' },
    { code: '310505', name: 'Capital Autorizado', type: 'PATRIMONIO', nature: 'CREDITO', level: 4, parent_code: '3105' },
    { code: '36', name: 'RESULTADOS DEL EJERCICIO', type: 'PATRIMONIO', nature: 'CREDITO', level: 2, parent_code: '3' },
    { code: '3605', name: 'UTILIDAD DEL EJERCICIO', type: 'PATRIMONIO', nature: 'CREDITO', level: 3, parent_code: '36' },
    { code: '360505', name: 'Utilidad del Ejercicio', type: 'PATRIMONIO', nature: 'CREDITO', level: 4, parent_code: '3605' },
    
    // INGRESOS
    { code: '4', name: 'INGRESOS', type: 'INGRESO', nature: 'CREDITO', level: 1 },
    { code: '41', name: 'OPERACIONALES', type: 'INGRESO', nature: 'CREDITO', level: 2, parent_code: '4' },
    { code: '4135', name: 'COMERCIO AL POR MAYOR Y MENOR', type: 'INGRESO', nature: 'CREDITO', level: 3, parent_code: '41' },
    { code: '413505', name: 'Venta de Mercancías', type: 'INGRESO', nature: 'CREDITO', level: 4, parent_code: '4135' },
    { code: '4170', name: 'SERVICIOS', type: 'INGRESO', nature: 'CREDITO', level: 3, parent_code: '41' },
    { code: '417005', name: 'Servicios Prestados', type: 'INGRESO', nature: 'CREDITO', level: 4, parent_code: '4170' },
    
    // GASTOS
    { code: '5', name: 'GASTOS', type: 'GASTO', nature: 'DEBITO', level: 1 },
    { code: '51', name: 'OPERACIONALES DE ADMINISTRACIÓN', type: 'GASTO', nature: 'DEBITO', level: 2, parent_code: '5' },
    { code: '5105', name: 'GASTOS DE PERSONAL', type: 'GASTO', nature: 'DEBITO', level: 3, parent_code: '51' },
    { code: '510506', name: 'Sueldos', type: 'GASTO', nature: 'DEBITO', level: 4, parent_code: '5105' },
    { code: '5195', name: 'DIVERSOS', type: 'GASTO', nature: 'DEBITO', level: 3, parent_code: '51' },
    { code: '519595', name: 'Otros Gastos', type: 'GASTO', nature: 'DEBITO', level: 4, parent_code: '5195' },
    
    // COSTOS
    { code: '6', name: 'COSTOS DE VENTAS', type: 'COSTO_VENTAS', nature: 'DEBITO', level: 1 },
    { code: '61', name: 'COSTO DE VENTAS Y PRESTACIÓN DE SERVICIOS', type: 'COSTO_VENTAS', nature: 'DEBITO', level: 2, parent_code: '6' },
    { code: '6135', name: 'COMERCIO AL POR MAYOR Y MENOR', type: 'COSTO_VENTAS', nature: 'DEBITO', level: 3, parent_code: '61' },
    { code: '613505', name: 'Costo de Mercancías Vendidas', type: 'COSTO_VENTAS', nature: 'DEBITO', level: 4, parent_code: '6135' },
];

// Terceros de prueba
const THIRD_PARTIES = [
    {
        document_type: 'NIT',
        document_number: '900123456',
        dv: 7,
        full_name: 'Distribuidora ABC S.A.S.',
        email: 'contacto@distribuidoraabc.com',
        phone: '3001234567',
        address: 'Calle 100 #15-20',
        city: 'Bogotá',
        is_client: true,
        is_provider: false,
        is_employee: false,
    },
    {
        document_type: 'NIT',
        document_number: '800987654',
        dv: 3,
        full_name: 'Comercializadora XYZ Ltda.',
        email: 'ventas@comercializadoraxyz.com',
        phone: '3109876543',
        address: 'Carrera 7 #45-12',
        city: 'Medellín',
        is_client: true,
        is_provider: false,
        is_employee: false,
    },
    {
        document_type: 'CC',
        document_number: '1098765432',
        full_name: 'Juan Carlos Pérez García',
        email: 'juanperez@gmail.com',
        phone: '3205551234',
        address: 'Calle 50 #30-15 Apto 401',
        city: 'Cali',
        is_client: true,
        is_provider: false,
        is_employee: false,
    },
    {
        document_type: 'NIT',
        document_number: '901234567',
        dv: 1,
        full_name: 'Proveedores del Norte S.A.',
        email: 'compras@proveedoresnorte.com',
        phone: '3157778899',
        address: 'Zona Industrial Norte Km 5',
        city: 'Barranquilla',
        is_client: false,
        is_provider: true,
        is_employee: false,
    },
    {
        document_type: 'NIT',
        document_number: '860456789',
        dv: 5,
        full_name: 'Suministros Industriales del Sur',
        email: 'info@suministrossur.com',
        phone: '3024445566',
        address: 'Avenida Industrial 123',
        city: 'Bogotá',
        is_client: false,
        is_provider: true,
        is_employee: false,
    },
    {
        document_type: 'NIT',
        document_number: '900555444',
        dv: 2,
        full_name: 'Tech Solutions Colombia',
        email: 'ventas@techsolutions.co',
        phone: '3183334455',
        address: 'Centro Empresarial Torre A Ofc 502',
        city: 'Bogotá',
        is_client: true,
        is_provider: true,
        is_employee: false,
    },
];

export async function seedDatabase() {
    const supabase = await createClient();
    
    const results = {
        puc: { inserted: 0, errors: [] as string[] },
        thirdParties: { inserted: 0, errors: [] as string[] },
    };

    // Seed PUC Accounts
    for (const account of PUC_ACCOUNTS) {
        const { error } = await supabase
            .from('puc_accounts')
            .upsert(account, { onConflict: 'code' });
        
        if (error) {
            results.puc.errors.push(`${account.code}: ${error.message}`);
        } else {
            results.puc.inserted++;
        }
    }

    // Seed Third Parties
    for (const party of THIRD_PARTIES) {
        const { error } = await supabase
            .from('third_parties')
            .upsert(party, { onConflict: 'document_type,document_number' });
        
        if (error) {
            results.thirdParties.errors.push(`${party.document_number}: ${error.message}`);
        } else {
            results.thirdParties.inserted++;
        }
    }

    return results;
}

export async function getSeededData() {
    const supabase = await createClient();
    
    const [pucResult, thirdPartiesResult] = await Promise.all([
        supabase.from('puc_accounts').select('code, name').order('code').limit(10),
        supabase.from('third_parties').select('document_number, full_name, is_client, is_provider').limit(10),
    ]);

    return {
        puc: pucResult.data || [],
        thirdParties: thirdPartiesResult.data || [],
    };
}
