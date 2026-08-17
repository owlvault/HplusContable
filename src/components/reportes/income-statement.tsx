'use client';

interface IncomeStatementItem {
    code: string;
    name: string;
    level: number;
    amount: number;
}

interface IncomeStatementProps {
    income: IncomeStatementItem[];
    expenses: IncomeStatementItem[];
    costs: IncomeStatementItem[];
    totalIncome: number;
    totalExpenses: number;
    totalCosts: number;
    netIncome: number;
    period: string;
}

export function IncomeStatement({ income, expenses, costs, totalIncome, totalExpenses, totalCosts, netIncome, period }: IncomeStatementProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const getIndent = (level: number) => {
        return { paddingLeft: `${(level - 1) * 16}px` };
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 print:shadow-none" data-testid="income-statement">
            <div className="text-center mb-6 border-b pb-4">
                <h1 className="text-xl font-bold text-gray-900">ESTADO DE RESULTADOS</h1>
                <h2 className="text-lg text-gray-600">HPlus Contable - CFO IA</h2>
                <p className="text-sm text-gray-500">{period}</p>
            </div>

            <div className="max-w-2xl mx-auto">
                {/* Income */}
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-green-700 border-b-2 border-green-200 pb-2 mb-2">INGRESOS OPERACIONALES</h3>
                    <div className="space-y-1">
                        {income.map((item) => (
                            <div key={item.code} className="flex justify-between py-1">
                                <span style={getIndent(item.level)} className={item.level <= 2 ? 'font-medium' : ''}>
                                    {item.code} - {item.name}
                                </span>
                                <span className={item.level <= 2 ? 'font-medium' : ''}>{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between py-2 mt-2 border-t font-bold text-green-700">
                        <span>TOTAL INGRESOS</span>
                        <span>{formatCurrency(totalIncome)}</span>
                    </div>
                </div>

                {/* Cost of Sales */}
                {costs.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-orange-700 border-b-2 border-orange-200 pb-2 mb-2">COSTO DE VENTAS</h3>
                        <div className="space-y-1">
                            {costs.map((item) => (
                                <div key={item.code} className="flex justify-between py-1">
                                    <span style={getIndent(item.level)}>{item.code} - {item.name}</span>
                                    <span>{formatCurrency(item.amount)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between py-2 mt-2 border-t font-bold text-orange-700">
                            <span>TOTAL COSTO DE VENTAS</span>
                            <span>({formatCurrency(totalCosts)})</span>
                        </div>
                    </div>
                )}

                {/* Gross Profit */}
                <div className="flex justify-between py-3 mb-6 bg-gray-100 px-4 rounded font-bold">
                    <span>UTILIDAD BRUTA</span>
                    <span>{formatCurrency(totalIncome - totalCosts)}</span>
                </div>

                {/* Expenses */}
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-red-700 border-b-2 border-red-200 pb-2 mb-2">GASTOS OPERACIONALES</h3>
                    <div className="space-y-1">
                        {expenses.map((item) => (
                            <div key={item.code} className="flex justify-between py-1">
                                <span style={getIndent(item.level)} className={item.level <= 2 ? 'font-medium' : ''}>
                                    {item.code} - {item.name}
                                </span>
                                <span className={item.level <= 2 ? 'font-medium' : ''}>{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between py-2 mt-2 border-t font-bold text-red-700">
                        <span>TOTAL GASTOS</span>
                        <span>({formatCurrency(totalExpenses)})</span>
                    </div>
                </div>

                {/* Net Income */}
                <div className={`flex justify-between py-4 px-4 rounded-lg font-bold text-xl ${netIncome >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <span>{netIncome >= 0 ? 'UTILIDAD NETA' : 'PÉRDIDA NETA'}</span>
                    <span>{formatCurrency(Math.abs(netIncome))}</span>
                </div>
            </div>
        </div>
    );
}
