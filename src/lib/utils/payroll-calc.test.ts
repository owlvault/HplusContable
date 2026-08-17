import { describe, it, expect } from 'vitest';
import {
    calculateProvisions,
    calculateSettlement,
    calculateContributions,
} from './payroll-calc';

describe('payroll-calc', () => {
    describe('calculateProvisions — provisión mensual', () => {
        it('calcula prestaciones sobre salario + auxilio (cesantías y prima)', () => {
            const p = calculateProvisions({ salaryBase: 1_423_500, transportAllowance: 200_000 });
            const base = 1_623_500;
            expect(p.cesantias).toBe(Math.round(base * 0.0833));
            expect(p.prima).toBe(Math.round(base * 0.0833));
            // Vacaciones solo sobre salario
            expect(p.vacaciones).toBe(Math.round(1_423_500 * 0.0417));
            // Intereses ~ 1% mensual de la base de cesantías
            expect(p.interesesCesantias).toBe(Math.round(p.cesantias * 0.12 / 12));
            expect(p.total).toBe(p.cesantias + p.interesesCesantias + p.prima + p.vacaciones);
        });

        it('sin auxilio de transporte para salarios altos', () => {
            const p = calculateProvisions({ salaryBase: 5_000_000, transportAllowance: 0 });
            expect(p.cesantias).toBe(Math.round(5_000_000 * 0.0833));
        });
    });

    describe('calculateSettlement — liquidación proporcional', () => {
        it('un año completo (360 días) equivale a un mes de salario en cesantías', () => {
            const s = calculateSettlement({
                monthlySalary: 1_423_500,
                transportAllowance: 200_000,
                daysWorkedYear: 360,
            });
            expect(s.cesantias).toBe(1_623_500); // base * 360/360
            expect(s.prima).toBe(1_623_500);
            // Vacaciones: 15 días = salario/24
            expect(s.vacaciones).toBe(Math.round(1_423_500 * 360 / 720));
        });

        it('medio año (180 días) es la mitad', () => {
            const s = calculateSettlement({
                monthlySalary: 2_000_000,
                transportAllowance: 0,
                daysWorkedYear: 180,
            });
            expect(s.cesantias).toBe(Math.round(2_000_000 * 180 / 360));
            expect(s.total).toBeGreaterThan(0);
        });
    });

    describe('calculateContributions', () => {
        it('aportes de empleado 4% salud + 4% pensión', () => {
            const c = calculateContributions({ ibc: 2_000_000, arlRiskLevel: 1 });
            expect(c.healthEmployee).toBe(80_000);
            expect(c.pensionEmployee).toBe(80_000);
            expect(c.totalEmployee).toBe(160_000);
        });

        it('exoneración de parafiscales pone salud/SENA/ICBF patronal en 0', () => {
            const c = calculateContributions({ ibc: 2_000_000, arlRiskLevel: 1, exoneratedParafiscales: true });
            expect(c.healthEmployer).toBe(0);
            expect(c.sena).toBe(0);
            expect(c.icbf).toBe(0);
            expect(c.pensionEmployer).toBe(240_000); // pensión no se exonera
            expect(c.cajaCompensacion).toBe(80_000); // caja tampoco
        });

        it('ARL varía por nivel de riesgo', () => {
            const c1 = calculateContributions({ ibc: 1_000_000, arlRiskLevel: 1 });
            const c5 = calculateContributions({ ibc: 1_000_000, arlRiskLevel: 5 });
            expect(c5.arl).toBeGreaterThan(c1.arl);
        });
    });
});
