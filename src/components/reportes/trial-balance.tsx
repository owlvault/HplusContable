'use client';

interface TrialBalanceItem {
    code: string;
    name: string;
    level: number;
    debit: number;
    credit: number;
    balance: number;
    nature: string;
}

interface TrialBalanceProps {
    data: TrialBalanceItem[];
    period: string;
}

export function TrialBalance({ data, period }: TrialBalanceProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const totals = data.reduce(
        (acc, item) => ({
            debit: acc.debit + item.debit,
            credit: acc.credit + item.credit,
        }),
        { debit: 0, credit: 0 }
    );

    const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid="trial-balance">
            <div className="p-4 border-b border-gray-200 bg-gray-50 text-center">
                <h1 className="text-xl font-bold text-gray-900">BALANCE DE COMPROBACIÓN</h1>
                <h2 className="text-lg text-gray-600">HPlus Contable - CFO IA</h2>
                <p className="text-sm text-gray-500">{period}</p>
            </div>

            {data.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <p>No hay movimientos en el período seleccionado</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuenta</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Débitos</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Créditos</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {data.map((item) => (
                                <tr key={item.code} className={item.level <= 2 ? 'bg-gray-50 font-medium' : ''}>
                                    <td className="px-4 py-2 text-gray-600">{item.code}</td>
                                    <td className="px-4 py-2 text-gray-900" style={{ paddingLeft: `${(item.level - 1) * 12 + 16}px` }}>
                                        {item.name}
                                    </td>
                                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(item.debit)}</td>
                                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(item.credit)}</td>
                                    <td className={`px-4 py-2 text-right font-medium ${item.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                        {formatCurrency(item.balance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-200 font-bold">
                            <tr>
                                <td className="px-4 py-3" colSpan={2}>TOTALES</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(totals.debit)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(totals.credit)}</td>
                                <td className="px-4 py-3 text-right">-</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Balance Check */}
            <div className={`m-4 p-4 rounded-lg ${isBalanced ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <p className="font-medium">
                    {isBalanced 
                        ? '✓ Partida doble correcta (Débitos = Créditos)'
                        : `⚠ Diferencia: ${formatCurrency(totals.debit - totals.credit)}`
                    }
                </p>
            </div>
        </div>
    );
}
