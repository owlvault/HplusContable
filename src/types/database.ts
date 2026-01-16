export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

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
                    created_at?: string
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
