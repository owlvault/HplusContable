'use server';

import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';

// Types for Electronic Invoicing (Facturación Electrónica DIAN)
export interface ElectronicInvoice {
    id: string;
    invoice_id: string;
    // DIAN Resolution
    dian_resolution_number: string;
    dian_resolution_date: string;
    dian_prefix: string;
    dian_range_from: number;
    dian_range_to: number;
    dian_technical_key?: string;
    // Electronic Invoice Data
    cufe?: string;  // Código Único de Factura Electrónica
    qr_code?: string;
    xml_content?: string;
    xml_signed?: string;
    pdf_url?: string;
    // DIAN Response
    dian_status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'ERROR';
    dian_response_code?: string;
    dian_response_message?: string;
    dian_validation_date?: string;
    // Tracking
    sent_at?: string;
    accepted_at?: string;
    rejection_reason?: string;
    retry_count: number;
    created_at: string;
    updated_at: string;
}

export interface DianResolution {
    id: string;
    resolution_number: string;
    resolution_date: string;
    prefix: string;
    range_from: number;
    range_to: number;
    current_number: number;
    technical_key: string;
    valid_from: string;
    valid_until: string;
    invoice_type: 'VENTA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface DianConfig {
    id: string;
    // Company Info for DIAN
    nit: string;
    dv: string;  // Dígito de verificación
    business_name: string;
    trade_name?: string;
    economic_activity_code: string;
    tax_regime: 'RESPONSABLE_IVA' | 'NO_RESPONSABLE_IVA' | 'REGIMEN_SIMPLE';
    // Address
    address: string;
    city_code: string;
    city_name: string;
    department_code: string;
    department_name: string;
    country_code: string;
    postal_code?: string;
    // Contact
    email: string;
    phone: string;
    // Technical
    software_id?: string;
    software_pin?: string;
    test_set_id?: string;
    environment: 'TEST' | 'PRODUCTION';
    certificate_path?: string;
    certificate_password?: string;
    // Status
    is_configured: boolean;
    last_sync_at?: string;
    created_at: string;
    updated_at: string;
}

// ============ DIAN CONFIG ============

export async function getDianConfig() {
    await enforcePermission('configuracion', 'read');
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('dian_config')
        .select('*')
        .single();
    
    if (error && error.code !== 'PGRST116') { // Not found is OK
        console.error('Error fetching DIAN config:', error);
        throw new Error('Error al obtener configuración DIAN');
    }
    
    return data;
}

export async function saveDianConfig(config: Partial<DianConfig>) {
    await enforcePermission('configuracion', 'write');
    
    const supabase = await createClient();
    
    // Check if config exists
    const { data: existing } = await supabase
        .from('dian_config')
        .select('id')
        .single();
    
    if (existing) {
        // Update
        const { error } = await supabase
            .from('dian_config')
            .update({
                ...config,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        
        if (error) throw new Error('Error al actualizar configuración DIAN');
    } else {
        // Insert
        const { error } = await supabase
            .from('dian_config')
            .insert({
                ...config,
                is_configured: false,
                environment: 'TEST',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        
        if (error) throw new Error('Error al crear configuración DIAN');
    }
    
    return { success: true };
}

// ============ DIAN RESOLUTIONS ============

export async function getDianResolutions() {
    await enforcePermission('configuracion', 'read');
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('dian_resolutions')
        .select('*')
        .order('resolution_date', { ascending: false });
    
    if (error) {
        console.error('Error fetching resolutions:', error);
        throw new Error('Error al obtener resoluciones DIAN');
    }
    
    return data || [];
}

export async function getActiveResolution(invoiceType: 'VENTA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' = 'VENTA') {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
        .from('dian_resolutions')
        .select('*')
        .eq('invoice_type', invoiceType)
        .eq('is_active', true)
        .lte('valid_from', today)
        .gte('valid_until', today)
        .lt('current_number', supabase.rpc('get_range_to')) // current_number < range_to
        .single();
    
    if (error) {
        return null;
    }
    
    return data;
}

export async function createDianResolution(resolution: Omit<DianResolution, 'id' | 'current_number' | 'created_at' | 'updated_at'>) {
    await enforcePermission('configuracion', 'write');
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('dian_resolutions')
        .insert({
            ...resolution,
            current_number: resolution.range_from - 1, // Start before first number
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating resolution:', error);
        throw new Error('Error al crear resolución DIAN');
    }
    
    return data;
}

// ============ ELECTRONIC INVOICES ============

export async function getElectronicInvoice(invoiceId: string) {
    await enforcePermission('facturas', 'read');
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('electronic_invoices')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching electronic invoice:', error);
    }
    
    return data;
}

export async function getElectronicInvoiceStatus(invoiceId: string) {
    const ei = await getElectronicInvoice(invoiceId);
    
    if (!ei) {
        return {
            status: 'NOT_CONFIGURED',
            message: 'Factura no configurada para facturación electrónica',
        };
    }
    
    return {
        status: ei.dian_status,
        cufe: ei.cufe,
        message: ei.dian_response_message,
        validationDate: ei.dian_validation_date,
    };
}

// Placeholder for future DIAN integration
export async function sendInvoiceToDian(_invoiceId: string) {
    await enforcePermission('facturas', 'approve');
    
    // This is a placeholder for future DIAN integration
    // The actual implementation will require:
    // 1. Generate XML-UBL 2.1 document
    // 2. Sign XML with digital certificate
    // 3. Calculate CUFE
    // 4. Send to DIAN Web Service
    // 5. Process response
    
    throw new Error('Integración con DIAN no implementada. Esta funcionalidad requiere configuración adicional con un proveedor tecnológico autorizado.');
}

// Generate CUFE (placeholder - actual implementation requires specific algorithm)
export function generateCUFE(
    invoiceNumber: string,
    invoiceDate: string,
    invoiceTime: string,
    totalAmount: number,
    taxAmount: number,
    sellerNit: string,
    buyerNit: string,
    technicalKey: string
): string {
    // CUFE = SHA384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + ... + NitOFE + NumAdq + ClTec)
    // This is a simplified placeholder
    const cufeString = `${invoiceNumber}${invoiceDate}${invoiceTime}${totalAmount}01${taxAmount}${sellerNit}${buyerNit}${technicalKey}`;
    // In production, use SHA-384 hash
    return `CUFE-PLACEHOLDER-${Buffer.from(cufeString).toString('base64').substring(0, 40)}`;
}

// Check if electronic invoicing is configured
export async function isElectronicInvoicingEnabled(): Promise<boolean> {
    try {
        const config = await getDianConfig();
        return config?.is_configured === true && config?.environment === 'PRODUCTION';
    } catch {
        return false;
    }
}
