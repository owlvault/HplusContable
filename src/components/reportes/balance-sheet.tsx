'use client';

interface BalanceSheetItem {
    code: string;
    name: string;
    level: number;
    balance: number;
}

interface BalanceSheetProps {
    assets: BalanceSheetItem[];
    liabilities: BalanceSheetItem[];
    equity: BalanceSheetItem[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    period: string;
}

export function BalanceSheet({ assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, period }: BalanceSheetProps) {
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

    const AccountSection = ({ title, items, total, color }: { title: string; items: BalanceSheetItem[]; total: number; color: string }) => (
        <div className="mb-6">
            <h3 className={`text-lg font-bold ${color} border-b-2 pb-2 mb-2`}>{title}</h3>
            <div className="space-y-1">
                {items.map((item) => (
                    <div key={item.code} className="flex justify-between py-1">
                        <span style={getIndent(item.level)} className={item.level <= 2 ? 'font-medium' : ''}>
                            {item.code} - {item.name}
                        </span>
                        <span className={item.level <= 2 ? 'font-medium' : ''}>{formatCurrency(item.balance)}</span>
                    </div>
                ))}
            </div>
            <div className={`flex justify-between py-2 mt-2 border-t-2 font-bold ${color}`}>
                <span>TOTAL {title.toUpperCase()}</span>
                <span>{formatCurrency(total)}</span>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 print:shadow-none" data-testid="balance-sheet">
            <div className="text-center mb-6 border-b pb-4">
                <h1 className="text-xl font-bold text-gray-900">ESTADO DE SITUACIÓN FINANCIERA</h1>
                <h2 className="text-lg text-gray-600">DigiKawsay S.A.S.</h2>
                <p className="text-sm text-gray-500">{period}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: Assets */}
                <div>
                    <AccountSection title="ACTIVO" items={assets} total={totalAssets} color="text-blue-700" />
                </div>

                {/* Right: Liabilities + Equity */}
                <div>
                    <AccountSection title="PASIVO" items={liabilities} total={totalLiabilities} color="text-red-700" />
                    <AccountSection title="PATRIMONIO" items={equity} total={totalEquity} color="text-green-700" />
                    
                    <div className="flex justify-between py-3 mt-4 border-t-4 border-gray-800 font-bold text-lg">
                        <span>TOTAL PASIVO + PATRIMONIO</span>
                        <span>{formatCurrency(totalLiabilities + totalEquity)}</span>
                    </div>
                </div>
            </div>

            {/* Balance Check */}
            <div className={`mt-6 p-4 rounded-lg ${Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <p className="font-medium">
                    {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 
                        ? '✓ Ecuación contable balanceada (Activo = Pasivo + Patrimonio)'
                        : `⚠ Diferencia: ${formatCurrency(totalAssets - (totalLiabilities + totalEquity))}`
                    }
                </p>
            </div>
        </div>
    );
}
