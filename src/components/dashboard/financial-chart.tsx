'use client';

import { useMemo } from 'react';
import { formatCOP } from '@/lib/utils/dian';

type DataPoint = {
    date: string;
    income: number;
    expense: number;
};

type Props = {
    data: DataPoint[];
};

export function FinancialChart({ data }: Props) {
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return { bars: [], maxValue: 0 };

        const maxValue = Math.max(
            ...data.flatMap(d => [d.income, d.expense])
        ) || 1;

        const bars = data.slice(-6).map((d, index) => ({
            ...d,
            incomeHeight: (d.income / maxValue) * 100,
            expenseHeight: (d.expense / maxValue) * 100,
            label: new Date(d.date + '-01').toLocaleDateString('es-CO', { month: 'short' })
        }));

        return { bars, maxValue };
    }, [data]);

    if (!data || data.length === 0) {
        return (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))' }}>
                No hay datos para mostrar
            </div>
        );
    }

    return (
        <div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'hsl(var(--accent))' }} />
                    <span>Ingresos</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'hsl(var(--error))' }} />
                    <span>Gastos</span>
                </div>
            </div>

            {/* Chart Container */}
            <div style={{ 
                height: 250, 
                display: 'flex', 
                alignItems: 'flex-end', 
                justifyContent: 'space-around',
                padding: '0 1rem',
                borderBottom: '1px solid hsl(var(--border))',
                position: 'relative'
            }}>
                {/* Grid Lines */}
                {[0, 25, 50, 75, 100].map(pct => (
                    <div
                        key={pct}
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: `${pct}%`,
                            borderTop: '1px dashed hsl(var(--border))',
                            opacity: 0.5
                        }}
                    />
                ))}

                {/* Bars */}
                {chartData.bars.map((bar, index) => (
                    <div
                        key={bar.date}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem',
                            zIndex: 1
                        }}
                    >
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: 200 }}>
                            {/* Income Bar */}
                            <div
                                style={{
                                    width: 24,
                                    height: `${bar.incomeHeight}%`,
                                    minHeight: bar.income > 0 ? 4 : 0,
                                    backgroundColor: 'hsl(var(--accent))',
                                    borderRadius: '4px 4px 0 0',
                                    transition: 'height 0.3s ease',
                                    cursor: 'pointer'
                                }}
                                title={`Ingresos: ${formatCOP(bar.income)}`}
                            />
                            {/* Expense Bar */}
                            <div
                                style={{
                                    width: 24,
                                    height: `${bar.expenseHeight}%`,
                                    minHeight: bar.expense > 0 ? 4 : 0,
                                    backgroundColor: 'hsl(var(--error))',
                                    borderRadius: '4px 4px 0 0',
                                    transition: 'height 0.3s ease',
                                    cursor: 'pointer'
                                }}
                                title={`Gastos: ${formatCOP(bar.expense)}`}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* X Axis Labels */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-around', 
                padding: '0.75rem 1rem 0',
                fontSize: '0.75rem',
                color: 'hsl(var(--text-secondary))'
            }}>
                {chartData.bars.map(bar => (
                    <span key={bar.date} style={{ textTransform: 'capitalize' }}>
                        {bar.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
