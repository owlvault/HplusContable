'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface InvoiceTemplate {
    id: string;
    name: string;
    is_default: boolean;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    company_name: string;
    company_nit: string;
    company_address: string;
    company_phone: string;
    company_email: string;
    company_website: string | null;
    footer_text: string | null;
    payment_terms: string | null;
    bank_info: string | null;
    show_logo: boolean;
    show_qr: boolean;
    created_at: string;
    updated_at: string;
}

// Get all templates
export async function getInvoiceTemplates(): Promise<InvoiceTemplate[]> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');
    
    if (error) {
        // Table might not exist yet, return default
        console.error('Error fetching templates:', error);
        return [await getDefaultTemplate()];
    }
    
    return data?.length ? data : [await getDefaultTemplate()];
}

// Get default template
export async function getDefaultTemplate(): Promise<InvoiceTemplate> {
    return {
        id: 'default',
        name: 'Plantilla Estándar',
        is_default: true,
        logo_url: null,
        primary_color: '#1e3a5f',
        secondary_color: '#2563eb',
        accent_color: '#10b981',
        company_name: 'DigiKawsay S.A.S.',
        company_nit: '900.123.456-7',
        company_address: 'Calle 123 # 45-67, Bogotá D.C.',
        company_phone: '+57 1 234 5678',
        company_email: 'contacto@digikawsay.app',
        company_website: 'www.digikawsay.app',
        footer_text: 'Gracias por su preferencia',
        payment_terms: 'Pago a 30 días',
        bank_info: 'Banco X - Cuenta Corriente: 123456789',
        show_logo: true,
        show_qr: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

// Get active template (or default)
export async function getActiveInvoiceTemplate(): Promise<InvoiceTemplate> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .eq('is_default', true)
        .single();
    
    if (error || !data) {
        return getDefaultTemplate();
    }
    
    return data;
}

// Create or update template
export async function saveInvoiceTemplate(template: Partial<InvoiceTemplate>) {
    const supabase = await createClient();
    
    if (template.id && template.id !== 'default') {
        // Update existing
        const { error } = await supabase
            .from('invoice_templates')
            .update({
                ...template,
                updated_at: new Date().toISOString(),
            })
            .eq('id', template.id);
        
        if (error) {
            console.error('Error updating template:', error);
            throw new Error('Error al actualizar plantilla');
        }
    } else {
        // Create new
        const { id, ...templateData } = template;
        const { error } = await supabase
            .from('invoice_templates')
            .insert({
                ...templateData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        
        if (error) {
            console.error('Error creating template:', error);
            throw new Error('Error al crear plantilla');
        }
    }
    
    revalidatePath('/configuracion');
    revalidatePath('/facturas');
}

// Set template as default
export async function setDefaultTemplate(templateId: string) {
    const supabase = await createClient();
    
    // Remove default from all
    await supabase
        .from('invoice_templates')
        .update({ is_default: false })
        .neq('id', templateId);
    
    // Set new default
    const { error } = await supabase
        .from('invoice_templates')
        .update({ is_default: true })
        .eq('id', templateId);
    
    if (error) {
        console.error('Error setting default template:', error);
        throw new Error('Error al establecer plantilla por defecto');
    }
    
    revalidatePath('/configuracion');
    revalidatePath('/facturas');
}

// Delete template
export async function deleteInvoiceTemplate(templateId: string) {
    const supabase = await createClient();
    
    // Check if it's the default
    const { data: template } = await supabase
        .from('invoice_templates')
        .select('is_default')
        .eq('id', templateId)
        .single();
    
    if (template?.is_default) {
        throw new Error('No se puede eliminar la plantilla por defecto');
    }
    
    const { error } = await supabase
        .from('invoice_templates')
        .delete()
        .eq('id', templateId);
    
    if (error) {
        console.error('Error deleting template:', error);
        throw new Error('Error al eliminar plantilla');
    }
    
    revalidatePath('/configuracion');
}
