'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, ChevronRight, TrendingUp } from 'lucide-react';
import { getNotificationSummary, getDueNotifications, DueNotification } from '@/actions/notifications';
import Link from 'next/link';

export function AlertsWidget() {
    const [summary, setSummary] = useState<any>(null);
    const [topAlerts, setTopAlerts] = useState<DueNotification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [sum, alerts] = await Promise.all([
                getNotificationSummary(),
                getDueNotifications(7, true)
            ]);
            setSummary(sum);
            setTopAlerts(alerts.slice(0, 5)); // Top 5 alertas
        } catch (error) {
            console.error('Error loading alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP', 
            minimumFractionDigits: 0,
            notation: 'compact',
            compactDisplay: 'short'
        }).format(value);
    };

    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                </div>
            </div>
        );
    }

    const hasAlerts = summary && summary.total > 0;

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-yellow-500" />
                    Alertas de Vencimiento
                </h3>
                {hasAlerts && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                        {summary.total} pendientes
                    </span>
                )}
            </div>

            {!hasAlerts ? (
                <div className="text-center py-6">
                    <CheckCircle className="mx-auto text-green-500 mb-2" size={40} />
                    <p className="text-gray-600 text-sm">Sin alertas pendientes</p>
                    <p className="text-gray-400 text-xs mt-1">Todos los documentos están al día</p>
                </div>
            ) : (
                <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className={`rounded-lg p-2 text-center ${summary.overdue > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <XCircle size={16} className={`mx-auto mb-1 ${summary.overdue > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                            <div className={`text-lg font-bold ${summary.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                {summary.overdue}
                            </div>
                            <div className="text-xs text-gray-500">Vencidos</div>
                        </div>
                        <div className={`rounded-lg p-2 text-center ${summary.dueToday > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                            <Clock size={16} className={`mx-auto mb-1 ${summary.dueToday > 0 ? 'text-yellow-500' : 'text-gray-400'}`} />
                            <div className={`text-lg font-bold ${summary.dueToday > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                {summary.dueToday}
                            </div>
                            <div className="text-xs text-gray-500">Hoy</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <TrendingUp size={16} className="mx-auto mb-1 text-blue-500" />
                            <div className="text-lg font-bold text-blue-600">{summary.upcoming}</div>
                            <div className="text-xs text-gray-500">Próximos</div>
                        </div>
                    </div>

                    {/* Amount at Risk */}
                    {summary.totalAmountAtRisk > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-red-700">Monto en riesgo</span>
                                <span className="font-bold text-red-600">{formatCurrency(summary.totalAmountAtRisk)}</span>
                            </div>
                        </div>
                    )}

                    {/* Top Alerts List */}
                    <div className="space-y-2 mb-4">
                        {topAlerts.map((alert) => (
                            <div 
                                key={`${alert.type}-${alert.id}`}
                                className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                                    alert.status === 'overdue' ? 'bg-red-50' :
                                    alert.status === 'due_today' ? 'bg-yellow-50' : 'bg-blue-50'
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    {alert.status === 'overdue' ? (
                                        <XCircle size={14} className="text-red-500 flex-shrink-0" />
                                    ) : alert.status === 'due_today' ? (
                                        <Clock size={14} className="text-yellow-500 flex-shrink-0" />
                                    ) : (
                                        <TrendingUp size={14} className="text-blue-500 flex-shrink-0" />
                                    )}
                                    <div className="truncate">
                                        <span className="font-medium">{alert.documentNumber}</span>
                                        <span className="text-gray-500 ml-1">- {alert.thirdPartyName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        alert.type === 'receivable' 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-purple-100 text-purple-700'
                                    }`}>
                                        {alert.type === 'receivable' ? 'CxC' : 'CxP'}
                                    </span>
                                    <span className="font-medium text-gray-700">{formatCurrency(alert.balance)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Link */}
                    <Link 
                        href="/cartera"
                        className="flex items-center justify-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium pt-2 border-t"
                    >
                        Ver cartera completa
                        <ChevronRight size={16} />
                    </Link>
                </>
            )}
        </div>
    );
}
