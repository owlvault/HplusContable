'use client';

import { AlertTriangle, Clock, AlertCircle } from 'lucide-react';

// La forma la define quien produce el dato, para que no se dupliquen
// definiciones que puedan divergir.
import type { OverdueAlert } from '@/actions/cartera';

interface AlertsPanelProps {
    alerts: OverdueAlert[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-100 border-red-300 text-red-800';
            case 'high': return 'bg-orange-100 border-orange-300 text-orange-800';
            case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
            default: return 'bg-blue-100 border-blue-300 text-blue-800';
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertCircle size={16} className="text-red-600" />;
            case 'high': return <AlertTriangle size={16} className="text-orange-600" />;
            default: return <Clock size={16} className="text-yellow-600" />;
        }
    };

    if (alerts.length === 0) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700">No hay alertas de vencimiento</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid="alerts-panel">
            <div className="p-4 border-b border-gray-200 bg-red-50">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="text-red-600" size={20} />
                    <h3 className="text-lg font-semibold text-red-800">
                        Alertas de Vencimiento ({alerts.length})
                    </h3>
                </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
                {alerts.slice(0, 10).map((alert) => (
                    <div
                        key={`${alert.type}-${alert.id}`}
                        className={`p-3 border-b border-gray-100 ${getSeverityColor(alert.severity)}`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {getSeverityIcon(alert.severity)}
                                <div>
                                    <p className="font-medium text-sm">
                                        {alert.documentNumber}
                                        <span className="ml-2 text-xs font-normal opacity-75">
                                            ({alert.type === 'receivable' ? 'Por Cobrar' : 'Por Pagar'})
                                        </span>
                                    </p>
                                    <p className="text-xs opacity-75">{alert.thirdParty}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-sm">{formatCurrency(alert.amount)}</p>
                                <p className="text-xs opacity-75">{alert.daysOverdue} días vencido</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {alerts.length > 10 && (
                <div className="p-2 text-center text-sm text-gray-500 bg-gray-50">
                    Y {alerts.length - 10} más...
                </div>
            )}
        </div>
    );
}
