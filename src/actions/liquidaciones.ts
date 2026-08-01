'use server';

import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import { calculateProvisions, calculateSettlement } from '@/lib/utils/payroll-calc';

// ---------------------------------------------------------------------
// Mapa de cuentas de nómina (parametrizado en payroll_account_map)
// ---------------------------------------------------------------------
async function getPayrollAccountMap(): Promise<Record<string, string>> {
    const supabase = await createClient();
    const { data } = await supabase.from('payroll_account_map').select('concept, account_code');
    const map: Record<string, string> = {};
    for (const row of data || []) {
        if (row.account_code) map[row.concept] = row.account_code;
    }
    return map;
}

// =====================================================================
// 3.1 Provisiones de prestaciones al aprobar la nómina
// =====================================================================
export async function generateProvisionsForPayroll(payrollId: string) {
    await enforcePermission('nomina', 'write');
    const supabase = await createClient();

    const { data: lines } = await supabase
        .from('payroll_lines')
        .select('employee_id, salary_earned, transportation_allowance')
        .eq('payroll_id', payrollId);

    if (!lines || lines.length === 0) {
        throw new Error('La nómina no tiene líneas para provisionar.');
    }

    // Limpiar provisiones previas de esta nómina (idempotencia)
    await supabase.from('payroll_provisions').delete().eq('payroll_id', payrollId);

    const rows = lines.map((l) => {
        const p = calculateProvisions({
            salaryBase: Number(l.salary_earned) || 0,
            transportAllowance: Number(l.transportation_allowance) || 0,
        });
        return {
            payroll_id: payrollId,
            employee_id: l.employee_id,
            cesantias: p.cesantias,
            intereses_cesantias: p.interesesCesantias,
            prima: p.prima,
            vacaciones: p.vacaciones,
            total: p.total,
        };
    });

    const { error } = await supabase.from('payroll_provisions').insert(rows);
    if (error) throw new Error(error.message);

    revalidatePath(`/nomina/${payrollId}`);
    return { success: true, count: rows.length };
}

// =====================================================================
// Contabilización de la nómina (asiento de causación)
// =====================================================================
export async function postPayrollJournalEntry(payrollId: string) {
    await enforcePermission('nomina', 'approve');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: payroll } = await supabase.from('payrolls').select('*').eq('id', payrollId).single();
    if (!payroll) throw new Error('Nómina no encontrada');

    const { data: lines } = await supabase.from('payroll_lines').select('*').eq('payroll_id', payrollId);
    if (!lines || lines.length === 0) throw new Error('La nómina no tiene líneas');

    const acc = await getPayrollAccountMap();
    const jl: Array<{ account_code: string; third_party_id: string | null; debit: number; credit: number; description?: string }> = [];

    // Totales
    let salario = 0, aux = 0, saludEmp = 0, pensionEmp = 0, neto = 0;
    let saludPat = 0, pensionPat = 0, arl = 0, parafiscales = 0;
    for (const l of lines) {
        salario += Number(l.salary_earned) || 0;
        aux += Number(l.transportation_allowance) || 0;
        saludEmp += Number(l.health_employee) || 0;
        pensionEmp += Number(l.pension_employee) || 0;
        neto += Number(l.net_pay) || 0;
        saludPat += Number(l.health_employer) || 0;
        pensionPat += Number(l.pension_employer) || 0;
        arl += Number(l.arl) || 0;
        parafiscales += (Number(l.sena) || 0) + (Number(l.icbf) || 0) + (Number(l.caja_compensacion) || 0);
    }

    const push = (code: string | undefined, debit: number, credit: number, desc: string) => {
        if (!code || (debit === 0 && credit === 0)) return;
        jl.push({ account_code: code, third_party_id: null, debit, credit, description: desc });
    };

    // Débitos (gastos)
    push(acc['gasto_salario'], salario, 0, 'Salarios');
    push(acc['gasto_aux_transporte'], aux, 0, 'Auxilio de transporte');
    push(acc['gasto_salud_pat'], saludPat, 0, 'Aporte salud patronal');
    push(acc['gasto_pension_pat'], pensionPat, 0, 'Aporte pensión patronal');
    push(acc['gasto_arl'], arl, 0, 'ARL');
    push(acc['gasto_parafiscales'], parafiscales, 0, 'Parafiscales');

    // Créditos (pasivos y retenciones)
    push(acc['retencion_salud_emp'], 0, saludEmp, 'Retención salud empleado');
    push(acc['retencion_pension_emp'], 0, pensionEmp, 'Retención pensión empleado');
    push(acc['pasivo_salud'], 0, saludPat, 'Salud por pagar');
    push(acc['pasivo_pension'], 0, pensionPat, 'Pensión por pagar');
    push(acc['pasivo_arl'], 0, arl, 'ARL por pagar');
    push(acc['pasivo_parafiscales'], 0, parafiscales, 'Parafiscales por pagar');
    push(acc['pasivo_salarios'], 0, neto, 'Salarios por pagar');

    // Cuadre por diferencia de redondeo → ajusta salarios por pagar
    const totalDebit = jl.reduce((s, x) => s + x.debit, 0);
    const totalCredit = jl.reduce((s, x) => s + x.credit, 0);
    const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
        const salLine = jl.find(x => x.account_code === acc['pasivo_salarios']);
        if (salLine) salLine.credit += diff;
    }

    const { data: entryId, error } = await supabase.rpc('create_journal_entry', {
        p_date: new Date(payroll.period_year, payroll.period_month - 1, 28).toISOString(),
        p_description: `Causación nómina ${payroll.period_month}/${payroll.period_year}`,
        p_created_by: user.id,
        p_lines: jl as unknown,
    });
    if (error) throw new Error(error.message);

    await supabase.from('journal_entries').update({ state: 'APROBADO' }).eq('id', entryId);
    await supabase.from('payrolls').update({ journal_entry_id: entryId }).eq('id', payrollId);

    revalidatePath(`/nomina/${payrollId}`);
    return { success: true, entryId };
}

// =====================================================================
// 3.2 Liquidaciones (definitivas / parciales)
// =====================================================================
export interface CreateSettlementInput {
    employeeId: string;
    type: 'DEFINITIVA' | 'PARCIAL';
    settlementDate: string;
    daysWorkedYear: number;
    otherPayments?: number;
    deductions?: number;
    notes?: string;
}

export async function createSettlement(input: CreateSettlementInput) {
    await enforcePermission('nomina', 'write');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: emp } = await supabase
        .from('employees')
        .select('base_salary')
        .eq('id', input.employeeId)
        .single();
    if (!emp) throw new Error('Empleado no encontrado');

    // Auxilio de transporte si el salario <= 2 SMLV (aprox.)
    const SMLV = 1_423_500;
    const AUX = 200_000;
    const transportAllowance = Number(emp.base_salary) <= SMLV * 2 ? AUX : 0;

    const s = calculateSettlement({
        monthlySalary: Number(emp.base_salary),
        transportAllowance,
        daysWorkedYear: input.daysWorkedYear,
    });

    const total = s.total + (input.otherPayments || 0) - (input.deductions || 0);

    const { data, error } = await supabase
        .from('severance_settlements')
        .insert({
            employee_id: input.employeeId,
            type: input.type,
            settlement_date: input.settlementDate,
            days_worked_year: input.daysWorkedYear,
            monthly_salary: Number(emp.base_salary),
            transport_allowance: transportAllowance,
            cesantias: s.cesantias,
            intereses_cesantias: s.interesesCesantias,
            prima: s.prima,
            vacaciones: s.vacaciones,
            other_payments: input.otherPayments || 0,
            deductions: input.deductions || 0,
            total,
            status: 'DRAFT',
            notes: input.notes,
            created_by: user?.id,
        })
        .select()
        .single();
    if (error) throw new Error(error.message);

    revalidatePath('/nomina');
    return data;
}

export async function getSettlements(employeeId?: string) {
    await enforcePermission('nomina', 'read');
    const supabase = await createClient();
    let query = supabase
        .from('severance_settlements')
        .select('*, employee:employees(first_name, last_name, document_number)')
        .order('settlement_date', { ascending: false });
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

export async function approveSettlement(id: string) {
    await enforcePermission('nomina', 'approve');
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('severance_settlements')
        .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'DRAFT')
        .select('id');
    if (error || !data || data.length !== 1) throw new Error('No se pudo aprobar la liquidación');
    revalidatePath('/nomina');
    return { success: true };
}

// =====================================================================
// 3.3 PILA — generación de planilla
// =====================================================================
export async function generatePILA(payrollId: string) {
    await enforcePermission('nomina', 'write');
    const supabase = await createClient();

    const { data: payroll } = await supabase.from('payrolls').select('*').eq('id', payrollId).single();
    if (!payroll) throw new Error('Nómina no encontrada');

    const { data: lines } = await supabase
        .from('payroll_lines')
        .select('*, employee:employees(document_type, document_number, first_name, last_name)')
        .eq('payroll_id', payrollId);
    if (!lines || lines.length === 0) throw new Error('La nómina no tiene líneas');

    let totalIbc = 0, totalHealth = 0, totalPension = 0, totalArl = 0, totalParafiscales = 0;
    const fileLines: string[] = [];

    for (const l of lines as any[]) {
        const ibc = (Number(l.salary_earned) || 0);
        const health = (Number(l.health_employee) || 0) + (Number(l.health_employer) || 0);
        const pension = (Number(l.pension_employee) || 0) + (Number(l.pension_employer) || 0);
        const arl = Number(l.arl) || 0;
        const paraf = (Number(l.sena) || 0) + (Number(l.icbf) || 0) + (Number(l.caja_compensacion) || 0);
        totalIbc += ibc; totalHealth += health; totalPension += pension; totalArl += arl; totalParafiscales += paraf;

        const e = l.employee || {};
        // Registro tipo 2 simplificado (separado por ;)
        fileLines.push([
            e.document_type || 'CC',
            e.document_number || '',
            `${e.first_name || ''} ${e.last_name || ''}`.trim(),
            Math.round(ibc),
            Math.round(health),
            Math.round(pension),
            Math.round(arl),
            Math.round(paraf),
        ].join(';'));
    }

    const totalContributions = totalHealth + totalPension + totalArl + totalParafiscales;
    const header = `1;${payroll.period_year}${String(payroll.period_month).padStart(2, '0')};E;${lines.length};${Math.round(totalIbc)}`;
    const fileContent = [header, ...fileLines].join('\n');

    // Reemplazar submission previa
    await supabase.from('pila_submissions').delete().eq('payroll_id', payrollId);

    const { data, error } = await supabase
        .from('pila_submissions')
        .insert({
            payroll_id: payrollId,
            period_year: payroll.period_year,
            period_month: payroll.period_month,
            total_ibc: totalIbc,
            total_health: totalHealth,
            total_pension: totalPension,
            total_arl: totalArl,
            total_parafiscales: totalParafiscales,
            total_contributions: totalContributions,
            employee_count: lines.length,
            file_content: fileContent,
        })
        .select()
        .single();
    if (error) throw new Error(error.message);

    revalidatePath(`/nomina/${payrollId}`);
    return data;
}
