export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

/** Tipos de documento de identificación aceptados por la DIAN. */
export type DocumentType = 'CC' | 'NIT' | 'CE' | 'PASAPORTE' | 'TI'

export interface Database {
    public: {
        Tables: {
            puc_accounts: {
                Row: {
                    code: string
                    name: string
                    type: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO_VENTAS' | 'COSTO_PRODUCCION' | 'CUENTAS_ORDEN'
                    nature: 'DEBITO' | 'CREDITO'
                    level: number
                    parent_code: string | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    code: string
                    name: string
                    type: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO_VENTAS' | 'COSTO_PRODUCCION' | 'CUENTAS_ORDEN'
                    nature: 'DEBITO' | 'CREDITO'
                    level: number
                    parent_code?: string | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    code?: string
                    name?: string
                    type?: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO_VENTAS' | 'COSTO_PRODUCCION' | 'CUENTAS_ORDEN'
                    nature?: 'DEBITO' | 'CREDITO'
                    level?: number
                    parent_code?: string | null
                    is_active?: boolean
                    created_at?: string
                }
            }
            third_parties: {
                Row: {
                    id: string
                    document_type: 'CC' | 'NIT' | 'CE' | 'PASAPORTE' | 'TI'
                    document_number: string
                    dv: number | null
                    full_name: string
                    email: string | null
                    phone: string | null
                    address: string | null
                    city: string | null
                    is_client: boolean
                    is_provider: boolean
                    is_employee: boolean
                    is_active: boolean
                    tax_regime: string
                    is_self_withholding: boolean
                    is_vat_withholding_agent: boolean
                    is_ica_withholding_agent: boolean
                    ciiu_code: string | null
                    tax_responsibilities: string[]
                    ica_rate_x_mil: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    document_type: 'CC' | 'NIT' | 'CE' | 'PASAPORTE' | 'TI'
                    document_number: string
                    dv?: number | null
                    full_name: string
                    email?: string | null
                    phone?: string | null
                    address?: string | null
                    city?: string | null
                    is_client?: boolean
                    is_provider?: boolean
                    is_employee?: boolean
                    is_active?: boolean
                    tax_regime?: string
                    is_self_withholding?: boolean
                    is_vat_withholding_agent?: boolean
                    is_ica_withholding_agent?: boolean
                    ciiu_code?: string | null
                    tax_responsibilities?: string[]
                    ica_rate_x_mil?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    document_type?: 'CC' | 'NIT' | 'CE' | 'PASAPORTE' | 'TI'
                    document_number?: string
                    dv?: number | null
                    full_name?: string
                    email?: string | null
                    phone?: string | null
                    address?: string | null
                    city?: string | null
                    is_client?: boolean
                    is_provider?: boolean
                    is_employee?: boolean
                    is_active?: boolean
                    tax_regime?: string
                    is_self_withholding?: boolean
                    is_vat_withholding_agent?: boolean
                    is_ica_withholding_agent?: boolean
                    ciiu_code?: string | null
                    tax_responsibilities?: string[]
                    ica_rate_x_mil?: number | null
                    created_at?: string
                    updated_at?: string
                }
            }
            company_settings: {
                Row: {
                    id: string
                    singleton: boolean
                    legal_name: string
                    trade_name: string | null
                    nit: string
                    dv: number | null
                    tax_regime: string
                    is_self_withholding: boolean
                    is_vat_withholding_agent: boolean
                    is_ica_withholding_agent: boolean
                    ciiu_code: string | null
                    address: string | null
                    city: string | null
                    department: string | null
                    phone: string | null
                    email: string | null
                    fiscal_year_start_month: number
                    default_accounts: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    singleton?: boolean
                    legal_name: string
                    trade_name?: string | null
                    nit: string
                    dv?: number | null
                    tax_regime?: string
                    is_self_withholding?: boolean
                    is_vat_withholding_agent?: boolean
                    is_ica_withholding_agent?: boolean
                    ciiu_code?: string | null
                    address?: string | null
                    city?: string | null
                    department?: string | null
                    phone?: string | null
                    email?: string | null
                    fiscal_year_start_month?: number
                    default_accounts?: Json
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    legal_name?: string
                    trade_name?: string | null
                    nit?: string
                    dv?: number | null
                    tax_regime?: string
                    is_self_withholding?: boolean
                    is_vat_withholding_agent?: boolean
                    is_ica_withholding_agent?: boolean
                    ciiu_code?: string | null
                    address?: string | null
                    city?: string | null
                    department?: string | null
                    phone?: string | null
                    email?: string | null
                    fiscal_year_start_month?: number
                    default_accounts?: Json
                    updated_at?: string
                }
            }
            journal_entries: {
                Row: {
                    id: string
                    date: string
                    description: string
                    sequence_number: number
                    state: 'BORRADOR' | 'APROBADO' | 'ANULADO'
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    date: string
                    description: string
                    sequence_number?: number
                    state?: 'BORRADOR' | 'APROBADO' | 'ANULADO'
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    date?: string
                    description?: string
                    sequence_number?: number
                    state?: 'BORRADOR' | 'APROBADO' | 'ANULADO'
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            journal_lines: {
                Row: {
                    id: string
                    entry_id: string
                    account_code: string
                    third_party_id: string | null
                    debit: number
                    credit: number
                    description: string | null
                }
                Insert: {
                    id?: string
                    entry_id: string
                    account_code: string
                    third_party_id?: string | null
                    debit?: number
                    credit?: number
                    description?: string | null
                }
                Update: {
                    id?: string
                    entry_id?: string
                    account_code?: string
                    third_party_id?: string | null
                    debit?: number
                    credit?: number
                    description?: string | null
                }
            }
        }
    }
}
