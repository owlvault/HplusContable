'use client';

import { formatCurrency, formatPercent } from '@/lib/utils/format';
import type { WaterfallStep } from '@/lib/utils/sales-calc';

/**
 * Cascada de precio a margen operativo.
 *
 * Muestra de dónde sale cada peso: cuánto se cedió en descuento, cuánto se
 * va en entrega y cuánto en estructura. Es la lectura que permite discutir
 * el precio con evidencia en vez de con intuición.
 */
export function MarginWaterfall({
    steps,
    currency = 'COP',
}: {
    steps: WaterfallStep[];
    currency?: string;
}) {
    // La barra se escala contra el paso más grande en valor absoluto.
    const maxAbs = Math.max(...steps.map((s) => Math.abs(s.amount)), 1);

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="margin-waterfall">
            <h3 className="font-semibold text-gray-900 mb-4">Cascada de margen</h3>
            <div className="space-y-2">
                {steps.map((step) => {
                    const width = (Math.abs(step.amount) / maxAbs) * 100;
                    const isSubtotal = step.kind === 'subtotal';
                    const isDeduction = step.kind === 'deduction';

                    return (
                        <div
                            key={step.key}
                            className={isSubtotal ? 'pt-2 border-t border-gray-200' : ''}
                        >
                            <div className="flex items-baseline justify-between text-sm mb-1">
                                <span className={isSubtotal ? 'font-semibold text-gray-900' : 'text-gray-600'}>
                                    {step.label}
                                </span>
                                <span className="flex items-baseline gap-3">
                                    <span className="text-xs text-gray-400 tabular-nums">
                                        {formatPercent(step.percentOfNet)}
                                    </span>
                                    <span
                                        className={`tabular-nums ${
                                            isSubtotal ? 'font-semibold text-gray-900' : isDeduction ? 'text-red-600' : 'text-gray-700'
                                        }`}
                                    >
                                        {formatCurrency(step.amount, currency)}
                                    </span>
                                </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded overflow-hidden">
                                <div
                                    className={`h-full rounded ${
                                        isSubtotal ? 'bg-blue-500' : isDeduction ? 'bg-red-300' : 'bg-gray-400'
                                    }`}
                                    style={{ width: `${width}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
