'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { enforcePermission } from '@/lib/rbac';

// Types
export interface Employee {
    id: string;
    document_type: 'CC' | 'CE' | 'TI' | 'PA';
    document_number: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    address?: string;
    hire_date: string;
    termination_date?: string;
    position: string;
    department?: string;
    base_salary: number;
    contract_type: 'INDEFINIDO' | 'FIJO' | 'OBRA_LABOR' | 'PRESTACION_SERVICIOS';
    payment_frequency: 'QUINCENAL' | 'MENSUAL';
    bank_name?: string;
    bank_account_type?: 'AHORROS' | 'CORRIENTE';
    bank_account_number?: string;
    eps?: string;
    pension_fund?: string;
    arl_risk_level: 1 | 2 | 3 | 4 | 5;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Payroll {
    id: string;
    period_year: number;
    period_month: number;
    period_type: 'PRIMERA_QUINCENA' | 'SEGUNDA_QUINCENA' | 'MENSUAL';
    status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
    total_earnings: number;
    total_deductions: number;
    total_employer_costs: number;
    net_pay: number;
    payment_date?: string;
    notes?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface PayrollLine {
    id: string;
    payroll_id: string;
    employee_id: string;
    employee?: Employee;
    base_salary: number;
    worked_days: number;
    // Devengados (Earnings)
    salary_earned: number;
    transportation_allowance: number;
    overtime_hours: number;
    overtime_amount: number;
    bonuses: number;
    commissions: number;
    other_earnings: number;
    total_earnings: number;
    // Deducciones empleado (Employee Deductions)
    health_employee: number;  // 4%
    pension_employee: number; // 4%
    solidarity_fund: number;  // >4 SMLV
    retention_source: number;
    other_deductions: number;
    total_deductions: number;
    // Aportes empleador (Employer Contributions)
    health_employer: number;   // 8.5%
    pension_employer: number;  // 12%
    arl: number;               // 0.522% - 6.96%
    sena: number;              // 2%
    icbf: number;              // 3%
    caja_compensacion: number; // 4%
    total_employer_costs: number;
    // Net
    net_pay: number;
}

// Colombian 2026 constants (adjust as needed)
const SMLV_2026 = 1_423_500; // Salario Mínimo Legal Vigente 2026 (estimate)
const AUX_TRANSPORTE_2026 = 200_000; // Auxilio de transporte 2026 (estimate)

// ARL risk rates
const ARL_RATES: Record<number, number> = {
    1: 0.00522,  // Riesgo mínimo
    2: 0.01044,  // Riesgo bajo
    3: 0.02436,  // Riesgo medio
    4: 0.04350,  // Riesgo alto
    5: 0.06960,  // Riesgo máximo
};

// ============ EMPLOYEES ============

export async function getEmployees(activeOnly = true) {
    await enforcePermission('nomina', 'read');
    
    const supabase = await createClient();
    
    let query = supabase
        .from('employees')
        .select('*')
        .order('last_name', { ascending: true });
    
    if (activeOnly) {
        query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching employees:', error);
        throw new Error('Error al obtener empleados');
    }
    
    return data || [];
}

export async function getEmployee(id: string) {
    await enforcePermission('nomina', 'read');
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        throw new Error('Empleado no encontrado');
    }
    
    return data;
}

export async function createEmployee(employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) {
    await enforcePermission('nomina', 'write');
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('employees')
        .insert({
            ...employeeData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating employee:', error);
        throw new Error('Error al crear empleado');
    }
    
    revalidatePath('/nomina/empleados');
    return data;
}

export async function updateEmployee(id: string, employeeData: Partial<Employee>) {
    await enforcePermission('nomina', 'write');
    
    const supabase = await createClient();
    
    const { error } = await supabase
        .from('employees')
        .update({
            ...employeeData,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    
    if (error) {
        console.error('Error updating employee:', error);
        throw new Error('Error al actualizar empleado');
    }
    
    revalidatePath('/nomina/empleados');
    revalidatePath(`/nomina/empleados/${id}`);
    return { success: true };
}

export async function deactivateEmployee(id: string) {
    await enforcePermission('nomina', 'write');
    
    const supabase = await createClient();
    
    const { error } = await supabase
        .from('employees')
        .update({
            is_active: false,
            termination_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    
    if (error) {
        throw new Error('Error al desactivar empleado');
    }
    
    revalidatePath('/nomina/empleados');
    return { success: true };
}

// ============ PAYROLL ============

export async function getPayrolls(year?: number) {
    await enforcePermission('nomina', 'read');
    
    const supabase = await createClient();
    
    let query = supabase
        .from('payrolls')
        .select('*')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
    
    if (year) {
        query = query.eq('period_year', year);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching payrolls:', error);
        throw new Error('Error al obtener nóminas');
    }
    
    return data || [];
}

export async function getPayroll(id: string) {
    await enforcePermission('nomina', 'read');
    
    const supabase = await createClient();
    
    const { data: payroll, error: payrollError } = await supabase
        .from('payrolls')
        .select('*')
        .eq('id', id)
        .single();
    
    if (payrollError) {
        console.error('Error fetching payroll:', payrollError);
        throw new Error('Nómina no encontrada');
    }
    
    const { data: lines, error: linesError } = await supabase
        .from('payroll_lines')
        .select(`
            *,
            employee:employees(id, first_name, last_name, document_number, position)
        `)
        .eq('payroll_id', id);
    
    if (linesError) {
        console.error('Error fetching payroll lines:', linesError);
    }
    
    return { ...payroll, lines: lines || [] };
}

export async function createPayroll(
    periodYear: number,
    periodMonth: number,
    periodType: 'PRIMERA_QUINCENA' | 'SEGUNDA_QUINCENA' | 'MENSUAL'
) {
    await enforcePermission('nomina', 'write');
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Check if payroll already exists for this period
    const { data: existing } = await supabase
        .from('payrolls')
        .select('id')
        .eq('period_year', periodYear)
        .eq('period_month', periodMonth)
        .eq('period_type', periodType)
        .maybeSingle();
    
    if (existing) {
        throw new Error('Ya existe una nómina para este período');
    }
    
    // Get active employees
    const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true);
    
    if (!employees || employees.length === 0) {
        throw new Error('No hay empleados activos para generar nómina');
    }
    
    // Create payroll header
    const { data: payroll, error: payrollError } = await supabase
        .from('payrolls')
        .insert({
            period_year: periodYear,
            period_month: periodMonth,
            period_type: periodType,
            status: 'DRAFT',
            total_earnings: 0,
            total_deductions: 0,
            total_employer_costs: 0,
            net_pay: 0,
            created_by: user?.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();
    
    if (payrollError) {
        console.error('Error creating payroll:', payrollError);
        throw new Error('Error al crear nómina');
    }
    
    // Calculate payroll lines for each employee
    const payrollLines = [];
    let totalEarnings = 0;
    let totalDeductions = 0;
    let totalEmployerCosts = 0;
    let totalNetPay = 0;
    
    for (const employee of employees) {
        const line = calculatePayrollLine(employee, periodType);
        payrollLines.push({
            ...line,
            payroll_id: payroll.id,
            employee_id: employee.id,
        });
        
        totalEarnings += line.total_earnings;
        totalDeductions += line.total_deductions;
        totalEmployerCosts += line.total_employer_costs;
        totalNetPay += line.net_pay;
    }
    
    // Insert payroll lines
    const { error: linesError } = await supabase
        .from('payroll_lines')
        .insert(payrollLines);
    
    if (linesError) {
        console.error('Error inserting payroll lines:', linesError);
        // Rollback payroll
        await supabase.from('payrolls').delete().eq('id', payroll.id);
        throw new Error('Error al generar líneas de nómina');
    }
    
    // Update payroll totals
    await supabase
        .from('payrolls')
        .update({
            total_earnings: totalEarnings,
            total_deductions: totalDeductions,
            total_employer_costs: totalEmployerCosts,
            net_pay: totalNetPay,
        })
        .eq('id', payroll.id);
    
    revalidatePath('/nomina');
    return payroll;
}

function calculatePayrollLine(
    employee: Employee,
    periodType: 'PRIMERA_QUINCENA' | 'SEGUNDA_QUINCENA' | 'MENSUAL'
): Omit<PayrollLine, 'id' | 'payroll_id' | 'employee_id' | 'employee'> {
    const baseSalary = employee.base_salary;
    const isQuincena = periodType !== 'MENSUAL';
    const divisor = isQuincena ? 2 : 1;
    const workedDays = isQuincena ? 15 : 30;
    
    // Devengados (Earnings)
    const salaryEarned = baseSalary / divisor;
    // Auxilio de transporte solo si salario <= 2 SMLV
    const transportationAllowance = baseSalary <= (SMLV_2026 * 2) ? AUX_TRANSPORTE_2026 / divisor : 0;
    const overtimeHours = 0;
    const overtimeAmount = 0;
    const bonuses = 0;
    const commissions = 0;
    const otherEarnings = 0;
    
    const totalEarnings = salaryEarned + transportationAllowance + overtimeAmount + bonuses + commissions + otherEarnings;
    
    // Base para aportes (sin auxilio de transporte)
    const ibc = salaryEarned + overtimeAmount + bonuses + commissions;
    
    // Deducciones empleado (Employee Deductions)
    const healthEmployee = Math.round(ibc * 0.04);  // 4%
    const pensionEmployee = Math.round(ibc * 0.04); // 4%
    // Fondo de solidaridad solo si salario > 4 SMLV
    const solidarityFund = baseSalary > (SMLV_2026 * 4) ? Math.round(ibc * 0.01) : 0;
    const retentionSource = 0; // Calcular según tabla de retención
    const otherDeductions = 0;
    
    const totalDeductions = healthEmployee + pensionEmployee + solidarityFund + retentionSource + otherDeductions;
    
    // Aportes empleador (Employer Contributions)
    const healthEmployer = Math.round(ibc * 0.085);  // 8.5%
    const pensionEmployer = Math.round(ibc * 0.12);  // 12%
    const arlRate = ARL_RATES[employee.arl_risk_level] || ARL_RATES[1];
    const arl = Math.round(ibc * arlRate);
    const sena = Math.round(ibc * 0.02);             // 2%
    const icbf = Math.round(ibc * 0.03);             // 3%
    const cajaCompensacion = Math.round(ibc * 0.04); // 4%
    
    const totalEmployerCosts = healthEmployer + pensionEmployer + arl + sena + icbf + cajaCompensacion;
    
    // Neto a pagar
    const netPay = totalEarnings - totalDeductions;
    
    return {
        base_salary: baseSalary,
        worked_days: workedDays,
        salary_earned: salaryEarned,
        transportation_allowance: transportationAllowance,
        overtime_hours: overtimeHours,
        overtime_amount: overtimeAmount,
        bonuses,
        commissions,
        other_earnings: otherEarnings,
        total_earnings: totalEarnings,
        health_employee: healthEmployee,
        pension_employee: pensionEmployee,
        solidarity_fund: solidarityFund,
        retention_source: retentionSource,
        other_deductions: otherDeductions,
        total_deductions: totalDeductions,
        health_employer: healthEmployer,
        pension_employer: pensionEmployer,
        arl,
        sena,
        icbf,
        caja_compensacion: cajaCompensacion,
        total_employer_costs: totalEmployerCosts,
        net_pay: netPay,
    };
}

export async function approvePayroll(id: string) {
    await enforcePermission('nomina', 'approve');
    
    const supabase = await createClient();
    
    const { data: result, error } = await supabase
        .from('payrolls')
        .update({
            status: 'APPROVED',
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'DRAFT')
        .select('id');
    
    if (error || !result || result.length !== 1) {
        throw new Error('No se pudo aprobar la nómina');
    }
    
    revalidatePath('/nomina');
    revalidatePath(`/nomina/${id}`);
    return { success: true };
}

export async function markPayrollAsPaid(id: string, paymentDate: string) {
    await enforcePermission('nomina', 'approve');
    
    const supabase = await createClient();
    
    const { data: result, error } = await supabase
        .from('payrolls')
        .update({
            status: 'PAID',
            payment_date: paymentDate,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'APPROVED')
        .select('id');
    
    if (error || !result || result.length !== 1) {
        throw new Error('No se pudo marcar la nómina como pagada');
    }
    
    revalidatePath('/nomina');
    revalidatePath(`/nomina/${id}`);
    return { success: true };
}

// Get payroll summary for dashboard
export async function getPayrollSummary() {
    await enforcePermission('nomina', 'read');
    
    const supabase = await createClient();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Get employee count
    const { count: employeeCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
    
    // Get current month payroll
    const { data: currentPayroll } = await supabase
        .from('payrolls')
        .select('*')
        .eq('period_year', currentYear)
        .eq('period_month', currentMonth)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    // Get YTD totals
    const { data: ytdPayrolls } = await supabase
        .from('payrolls')
        .select('net_pay, total_employer_costs')
        .eq('period_year', currentYear)
        .eq('status', 'PAID');
    
    const ytdNetPay = ytdPayrolls?.reduce((sum, p) => sum + (p.net_pay || 0), 0) || 0;
    const ytdEmployerCosts = ytdPayrolls?.reduce((sum, p) => sum + (p.total_employer_costs || 0), 0) || 0;
    
    return {
        employeeCount: employeeCount || 0,
        currentPayroll,
        ytdNetPay,
        ytdEmployerCosts,
        ytdTotal: ytdNetPay + ytdEmployerCosts,
    };
}
