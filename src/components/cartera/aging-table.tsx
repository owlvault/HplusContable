'use client';

interface AgingBucket {
    range: string;
    count: number;
    total: number;
}

interface AgingTableProps {
    title: string;
    data: AgingBucket[];
    type: 'receivable' | 'payable';
}

export function AgingTable({ title, data, type }: AgingTableProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const total = data.reduce((sum, bucket) => sum + bucket.total, 0);
    const totalCount = data.reduce((sum, bucket) => sum + bucket.count, 0);

    const getRowColor = (range: string) => {
        if (range === 'Corriente') return 'bg-green-50';
        if (range === '1-30 días') return 'bg-yellow-50';
        if (range === '31-60 días') return 'bg-orange-50';
        if (range === '61-90 días') return 'bg-red-50';
        return 'bg-red-100';
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid={`aging-table-${type}`}>
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            </div>
            <table className="w-full">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Antigüedad
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                            Documentos
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Monto
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            %
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {data.map((bucket) => (
                        <tr key={bucket.range} className={getRowColor(bucket.range)}>
                            <td className="px-4 py-2 text-sm text-gray-900">{bucket.range}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 text-center">{bucket.count}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                                {formatCurrency(bucket.total)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600 text-right">
                                {total > 0 ? ((bucket.total / total) * 100).toFixed(1) : 0}%
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-100">
                    <tr className="font-bold">
                        <td className="px-4 py-2 text-sm text-gray-900">TOTAL</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-center">{totalCount}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(total)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">100%</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
