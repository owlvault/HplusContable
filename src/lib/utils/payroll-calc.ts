// =====================================================================
// Cálculos de nómina colombiana (lógica pura, sin acceso a datos).
// Prestaciones sociales (cesantías, intereses, prima, vacaciones) y
// liquidación definitiva/parcial proporcional a los días trabajados.
// =====================================================================

// Factores legales (Código Sustantivo del Trabajo)
export const FACTOR_CESANTIAS = 0.0833;      // 1/12  (un mes de salario por año)
export const FACTOR_INTERESES = 0.12;        // 12% anual sobre cesantías
export const FACTOR_PRIMA = 0.0833;          // 1/12  (medio salario por semestre)
export const FACTOR_VACACIONES = 0.0417;     // 1/24  (15 días hábiles por año)

/** Base de liquidación: cesantías y prima incluyen auxilio de transporte. */
export interface ProvisionInput {
    salaryBase: number;            // salario devengado del período
    transportAllowance: number;    // auxilio de transporte del período
}

export interface Provisions {
    cesantias: number;
    interesesCesantias: number;
    prima: number;
    vacaciones: number;
    total: number;
}

/**
 * Provisión mensual de prestaciones sociales.
 * - Cesantías y prima: (salario + auxilio de transporte) * factor.
 * - Intereses a las cesantías: 12% anual → mensual = cesantías * 12% / 12 = cesantías * 1%.
 * - Vacaciones: solo sobre el salario (sin auxilio de transporte).
 */
export function calculateProvisions(input: ProvisionInput): Provisions {
    const baseConAux = input.salaryBase + input.transportAllowance;
    const cesantias = Math.round(baseConAux * FACTOR_CESANTIAS);
    const interesesCesantias = Math.round(cesantias * FACTOR_INTERESES / 12);
    const prima = Math.round(baseConAux * FACTOR_PRIMA);
    const vacaciones = Math.round(input.salaryBase * FACTOR_VACACIONES);
    return {
        cesantias,
        interesesCesantias,
        prima,
        vacaciones,
        total: cesantias + interesesCesantias + prima + vacaciones,
    };
}

export interface SettlementInput {
    monthlySalary: number;         // salario mensual base
    transportAllowance: number;    // auxilio mensual (si aplica)
    /** Días trabajados en el año para cesantías/prima/vacaciones (base 360). */
    daysWorkedYear: number;
    /** Días de cesantías ya pagados/consignados (para liquidación parcial). */
    cesantiasAlreadyPaidDays?: number;
    /** Días de vacaciones ya disfrutados. */
    vacationDaysTaken?: number;
}

export interface Settlement {
    cesantias: number;
    interesesCesantias: number;
    prima: number;
    vacaciones: number;
    total: number;
    baseDays: number;
}

/**
 * Liquidación de prestaciones proporcional a los días trabajados (base 360).
 * Fórmulas legales:
 *   Cesantías = base * díasTrabajados / 360
 *   Intereses = cesantías * 12% * díasTrabajados / 360
 *   Prima     = base * díasTrabajados / 360
 *   Vacaciones= salario * díasTrabajados / 720   (15 días hábiles/año)
 */
export function calculateSettlement(input: SettlementInput): Settlement {
    const baseConAux = input.monthlySalary + input.transportAllowance;
    const dias = input.daysWorkedYear;

    const cesantias = Math.round((baseConAux * dias) / 360);
    const interesesCesantias = Math.round((cesantias * FACTOR_INTERESES * dias) / 360);
    const prima = Math.round((baseConAux * dias) / 360);

    const vacDaysBase = Math.max(0, dias - (input.vacationDaysTaken ?? 0) * (360 / 15));
    const vacaciones = Math.round((input.monthlySalary * vacDaysBase) / 720);

    return {
        cesantias,
        interesesCesantias,
        prima,
        vacaciones,
        total: cesantias + interesesCesantias + prima + vacaciones,
        baseDays: dias,
    };
}

// ---------------------------------------------------------------------
// Base de Cotización (IBC) y aportes — reutilizable por la nómina
// ---------------------------------------------------------------------
export const ARL_RATES: Record<number, number> = {
    1: 0.00522, 2: 0.01044, 3: 0.02436, 4: 0.0435, 5: 0.0696,
};

export interface ContributionsInput {
    ibc: number;                 // base de cotización
    arlRiskLevel: 1 | 2 | 3 | 4 | 5;
    /** Empresa exonerada de aportes (Ley 1607) para salud/SENA/ICBF si salario < 10 SMLV. */
    exoneratedParafiscales?: boolean;
}

export interface Contributions {
    healthEmployee: number;
    pensionEmployee: number;
    healthEmployer: number;
    pensionEmployer: number;
    arl: number;
    sena: number;
    icbf: number;
    cajaCompensacion: number;
    totalEmployee: number;
    totalEmployer: number;
}

export function calculateContributions(input: ContributionsInput): Contributions {
    const { ibc } = input;
    const healthEmployee = Math.round(ibc * 0.04);
    const pensionEmployee = Math.round(ibc * 0.04);
    const exon = input.exoneratedParafiscales ?? false;

    const healthEmployer = exon ? 0 : Math.round(ibc * 0.085);
    const pensionEmployer = Math.round(ibc * 0.12);
    const arl = Math.round(ibc * (ARL_RATES[input.arlRiskLevel] || ARL_RATES[1]));
    const sena = exon ? 0 : Math.round(ibc * 0.02);
    const icbf = exon ? 0 : Math.round(ibc * 0.03);
    const cajaCompensacion = Math.round(ibc * 0.04);

    return {
        healthEmployee, pensionEmployee,
        healthEmployer, pensionEmployer, arl, sena, icbf, cajaCompensacion,
        totalEmployee: healthEmployee + pensionEmployee,
        totalEmployer: healthEmployer + pensionEmployer + arl + sena + icbf + cajaCompensacion,
    };
}
