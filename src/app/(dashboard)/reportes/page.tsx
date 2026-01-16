'use client';

import { useState, useEffect } from 'react';
import { getTrialBalance, getIncomeStatement } from '@/actions/reports';
import { formatCOP } from '@/lib/utils/dian';

type ReportType = 'trial-balance' | 'income-statement';

export default function ReportesPage() {
    const [reportType, setReportType] = useState<ReportType>('trial-balance');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [trialBalance, setTrialBalance] = useState<any>(null);
    const [incomeStatement, setIncomeStatement] = useState<any>(null);

    const loadReport = async () => {
        setLoading(true);
        try {
            if (reportType === 'trial-balance') {
                const data = await getTrialBalance(startDate || undefined, endDate || undefined);
                setTrialBalance(data);
                setIncomeStatement(null);
            } else {
                const data = await getIncomeStatement(startDate || undefined, endDate || undefined);
                setIncomeStatement(data);
                setTrialBalance(null);
            }
        } catch (error) {
            console.error('Error loading report:', error);
        }
        setLoading(false);
    };

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Reportes Financieros</h1>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem' }}>
                    Genera balance de prueba y estado de resultados
                </p>
            </div>

            {/* Controls */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Tipo de Reporte</label>
                        <select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value as ReportType)}
                            style={{ padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', minWidth: '200px' }}
                        >
                            <option value="trial-balance">Balance de Prueba</option>
                            <option value="income-statement">Estado de Resultados</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Desde</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Hasta</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                        />
                    </div>
                    <button onClick={loadReport} disabled={loading} className="btn btn-primary" data-testid="generate-report-button">
                        {loading ? 'Generando...' : 'Generar Reporte'}
                    </button>
                </div>
            </div>

            {/* Trial Balance Report */}
            {trialBalance && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--surface-hover))' }}>
                        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Balance de Prueba</h2>
                        {startDate && endDate && (
                            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))', margin: '0.25rem 0 0' }}>
                                {startDate} al {endDate}
                            </p>
                        )}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid hsl(var(--border))', fontSize: '0.875rem' }}>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Código</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Cuenta</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Débito</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Crédito</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trialBalance.accounts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                                        No hay movimientos contables aprobados en el período seleccionado.
                                    </td>
                                </tr>
                            ) : (
                                trialBalance.accounts.map((acc: any) => (
                                    <tr key={acc.code} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{acc.code}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>{acc.name}</td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCOP(acc.debit)}</td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCOP(acc.credit)}</td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 500, color: acc.balance >= 0 ? 'hsl(var(--accent))' : 'hsl(var(--error))' }}>
                                            {formatCOP(acc.balance)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {trialBalance.accounts.length > 0 && (
                            <tfoot style={{ backgroundColor: 'hsl(var(--surface-hover))' }}>
                                <tr style={{ fontWeight: 'bold' }}>
                                    <td colSpan={2} style={{ padding: '1rem' }}>TOTALES</td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>{formatCOP(trialBalance.totalDebit)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>{formatCOP(trialBalance.totalCredit)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <span style={{ color: trialBalance.isBalanced ? 'hsl(var(--accent))' : 'hsl(var(--error))' }}>
                                            {trialBalance.isBalanced ? '✓ Cuadrado' : '✗ Descuadrado'}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            {/* Income Statement Report */}
            {incomeStatement && (
                <div className="card">
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>Estado de Resultados</h2>
                        {startDate && endDate && (
                            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))' }}>
                                {startDate} al {endDate}
                            </p>
                        )}
                    </div>

                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        {/* Ingresos */}
                        <div>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'hsl(var(--accent))' }}>INGRESOS</h3>
                            {incomeStatement.incomeDetails.length === 0 ? (
                                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem' }}>Sin ingresos registrados</p>
                            ) : (
                                incomeStatement.incomeDetails.map((item: any) => (
                                    <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid hsl(var(--border))' }}>
                                        <span>{item.code} - {item.name}</span>
                                        <span>{formatCOP(item.amount)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', fontWeight: 'bold' }}>
                                <span>Total Ingresos</span>
                                <span style={{ color: 'hsl(var(--accent))' }}>{formatCOP(incomeStatement.income)}</span>
                            </div>
                        </div>

                        {/* Costo de Ventas */}
                        {incomeStatement.costOfSales > 0 && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', fontWeight: 'bold', borderTop: '1px solid hsl(var(--border))' }}>
                                    <span>(-) Costo de Ventas</span>
                                    <span style={{ color: 'hsl(var(--error))' }}>{formatCOP(incomeStatement.costOfSales)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', fontWeight: 'bold', backgroundColor: 'hsl(var(--surface-hover))', margin: '0 -1.5rem', padding: '0.75rem 1.5rem' }}>
                                    <span>UTILIDAD BRUTA</span>
                                    <span>{formatCOP(incomeStatement.grossProfit)}</span>
                                </div>
                            </div>
                        )}

                        {/* Gastos */}
                        <div>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'hsl(var(--error))' }}>GASTOS OPERACIONALES</h3>
                            {incomeStatement.expenseDetails.length === 0 ? (
                                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem' }}>Sin gastos registrados</p>
                            ) : (
                                incomeStatement.expenseDetails.map((item: any) => (
                                    <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid hsl(var(--border))' }}>
                                        <span>{item.code} - {item.name}</span>
                                        <span>{formatCOP(item.amount)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', fontWeight: 'bold' }}>
                                <span>Total Gastos</span>
                                <span style={{ color: 'hsl(var(--error))' }}>{formatCOP(incomeStatement.expenses)}</span>
                            </div>
                        </div>

                        {/* Utilidad Neta */}
                        <div style={{ backgroundColor: incomeStatement.netProfit >= 0 ? 'hsl(var(--accent)/0.1)' : 'hsl(var(--error)/0.1)', margin: '0 -1.5rem -1.5rem', padding: '1.5rem', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                <span>UTILIDAD NETA</span>
                                <span style={{ color: incomeStatement.netProfit >= 0 ? 'hsl(var(--accent))' : 'hsl(var(--error))' }}>
                                    {formatCOP(incomeStatement.netProfit)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!trialBalance && !incomeStatement && !loading && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-secondary))' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📈</span>
                    <p>Selecciona un tipo de reporte y haz clic en "Generar Reporte"</p>
                </div>
            )}
        </div>
    );
}
