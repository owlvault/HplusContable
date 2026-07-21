'use client';

import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { getDueNotifications, DueNotification, getNotificationSummary } from '@/actions/notifications';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface NotificationBellProps {
    className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
    const [notifications, setNotifications] = useState<DueNotification[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [showDialog, setShowDialog] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        try {
            const [notifs, sum] = await Promise.all([
                getDueNotifications(7, true),
                getNotificationSummary()
            ]);
            setNotifications(notifs);
            setSummary(sum);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP', 
            minimumFractionDigits: 0 
        }).format(value);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'short'
        });
    };

    const getStatusIcon = (status: DueNotification['status']) => {
        switch (status) {
            case 'overdue':
                return <XCircle className="text-red-500" size={16} />;
            case 'due_today':
                return <AlertTriangle className="text-yellow-500" size={16} />;
            case 'upcoming':
                return <Clock className="text-blue-500" size={16} />;
        }
    };

    const getStatusLabel = (status: DueNotification['status'], days: number) => {
        if (status === 'overdue') return `Vencido hace ${Math.abs(days)} días`;
        if (status === 'due_today') return 'Vence hoy';
        return `Vence en ${days} días`;
    };

    const getPriorityColor = (priority: DueNotification['priority']) => {
        switch (priority) {
            case 'critical': return 'border-l-red-600 bg-red-50';
            case 'high': return 'border-l-orange-500 bg-orange-50';
            case 'medium': return 'border-l-yellow-500 bg-yellow-50';
            case 'low': return 'border-l-blue-500 bg-blue-50';
        }
    };

    const criticalCount = summary?.critical || 0;
    const hasNotifications = notifications.length > 0;

    return (
        <>
            <button
                onClick={() => setShowDialog(true)}
                className={`relative p-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
                title="Notificaciones de vencimiento"
                data-testid="notification-bell"
            >
                <Bell size={20} className="text-gray-600" />
                {hasNotifications && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold text-white rounded-full ${
                        criticalCount > 0 ? 'bg-red-600' : 'bg-yellow-500'
                    }`}>
                        {notifications.length > 99 ? '99+' : notifications.length}
                    </span>
                )}
            </button>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Bell size={20} />
                            Alertas de Vencimiento
                        </DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-gray-500">
                            Cargando notificaciones...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="py-8 text-center">
                            <CheckCircle className="mx-auto text-green-500 mb-2" size={48} />
                            <p className="text-gray-600">No hay documentos próximos a vencer</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary */}
                            {summary && (
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <div className="bg-red-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-red-600">{summary.overdue}</div>
                                        <div className="text-xs text-red-700">Vencidos</div>
                                    </div>
                                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-yellow-600">{summary.dueToday}</div>
                                        <div className="text-xs text-yellow-700">Vencen hoy</div>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-blue-600">{summary.upcoming}</div>
                                        <div className="text-xs text-blue-700">Próximos 7 días</div>
                                    </div>
                                </div>
                            )}

                            {/* Notification List */}
                            <div className="overflow-y-auto flex-1 space-y-2 pr-2">
                                {notifications.slice(0, 20).map((notif) => (
                                    <div 
                                        key={`${notif.type}-${notif.id}`}
                                        className={`border-l-4 rounded-r-lg p-3 ${getPriorityColor(notif.priority)}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(notif.status)}
                                                    <span className="font-medium text-sm truncate">
                                                        {notif.documentNumber}
                                                    </span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                        notif.type === 'receivable' 
                                                            ? 'bg-green-100 text-green-700' 
                                                            : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                        {notif.type === 'receivable' ? 'Por cobrar' : 'Por pagar'}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-600 truncate mt-1">
                                                    {notif.thirdPartyName}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    <span>{getStatusLabel(notif.status, notif.daysUntilDue)}</span>
                                                    <span>•</span>
                                                    <span>{formatDate(notif.dueDate)}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold text-sm">
                                                    {formatCurrency(notif.balance)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="pt-3 border-t mt-3">
                                <Link 
                                    href="/cartera"
                                    className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    onClick={() => setShowDialog(false)}
                                >
                                    Ver toda la cartera
                                    <ChevronRight size={16} />
                                </Link>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
