'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface ChartProps {
    data: any;
    type: 'pie' | 'bar';
    title?: string;
}

export function ReportChart({ data, type, title }: ChartProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP', 
            minimumFractionDigits: 0,
            notation: 'compact',
            compactDisplay: 'short'
        }).format(value);
    };

    if (type === 'pie') {
        return (
            <div className="w-full h-64">
                {title && <h4 className="text-sm font-medium text-gray-700 mb-2 text-center">{title}</h4>}
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {data.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div className="w-full h-64">
            {title && <h4 className="text-sm font-medium text-gray-700 mb-2 text-center">{title}</h4>}
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="value" fill="#0088FE" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Gráfico para Balance General - Activos vs Pasivos vs Patrimonio
export function BalanceSheetChart({ data }: { data: any }) {
    const chartData = [
        { name: 'Activos', value: data.total_assets || 0 },
        { name: 'Pasivos', value: data.total_liabilities || 0 },
        { name: 'Patrimonio', value: data.total_equity || 0 },
    ];

    return (
        <div className="bg-white rounded-lg border p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Composición del Balance</h4>
            <ReportChart data={chartData} type="pie" />
        </div>
    );
}

// Gráfico para Estado de Resultados - Ingresos vs Gastos
export function IncomeStatementChart({ data }: { data: any }) {
    const chartData = [
        { name: 'Ingresos', value: data.total_income || 0 },
        { name: 'Gastos', value: Math.abs(data.total_expenses || 0) },
        { name: 'Costos', value: Math.abs(data.total_costs || 0) },
    ].filter(item => item.value > 0);

    const profitData = [
        { name: 'Ingresos', value: data.total_income || 0, fill: '#00C49F' },
        { name: 'Egresos', value: Math.abs(data.total_expenses || 0) + Math.abs(data.total_costs || 0), fill: '#FF8042' },
        { name: 'Utilidad', value: data.net_income || 0, fill: data.net_income >= 0 ? '#0088FE' : '#FF0000' },
    ];

    return (
        <div className="bg-white rounded-lg border p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Análisis de Resultados</h4>
            <div className="grid grid-cols-2 gap-4">
                <ReportChart data={chartData} type="pie" title="Distribución" />
                <ReportChart data={profitData} type="bar" title="Comparativo" />
            </div>
        </div>
    );
}

// Gráfico para Cartera - Distribución por cliente/proveedor
export function CarteraChart({ data, type }: { data: any[], type: 'receivable' | 'payable' }) {
    const top5 = data
        .sort((a, b) => b.total_pending - a.total_pending)
        .slice(0, 5)
        .map(item => ({
            name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
            value: item.total_pending,
        }));

    if (top5.length === 0) return null;

    return (
        <div className="bg-white rounded-lg border p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">
                Top 5 {type === 'receivable' ? 'Clientes' : 'Proveedores'} por Saldo Pendiente
            </h4>
            <ReportChart data={top5} type="bar" />
        </div>
    );
}

// Gráfico para Balance de Comprobación - Top cuentas
export function TrialBalanceChart({ data }: { data: any }) {
    const accounts = data.accounts || [];
    
    const topDebits = accounts
        .filter((acc: any) => acc.debit_balance > 0)
        .sort((a: any, b: any) => b.debit_balance - a.debit_balance)
        .slice(0, 5)
        .map((acc: any) => ({
            name: acc.name.length > 20 ? acc.name.substring(0, 20) + '...' : acc.name,
            value: acc.debit_balance,
        }));

    const topCredits = accounts
        .filter((acc: any) => acc.credit_balance > 0)
        .sort((a: any, b: any) => b.credit_balance - a.credit_balance)
        .slice(0, 5)
        .map((acc: any) => ({
            name: acc.name.length > 20 ? acc.name.substring(0, 20) + '...' : acc.name,
            value: acc.credit_balance,
        }));

    if (topDebits.length === 0 && topCredits.length === 0) return null;

    return (
        <div className="bg-white rounded-lg border p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Top Cuentas por Saldo</h4>
            <div className="grid grid-cols-2 gap-4">
                {topDebits.length > 0 && <ReportChart data={topDebits} type="bar" title="Débitos" />}
                {topCredits.length > 0 && <ReportChart data={topCredits} type="bar" title="Créditos" />}
            </div>
        </div>
    );
}
