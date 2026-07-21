'use client';

import { useState, useEffect } from 'react';
import { History, User, Clock } from 'lucide-react';
import { getRecordHistory, AuditLog } from '@/actions/audit';
import { formatAuditAction } from '@/lib/audit-helpers';

interface AuditHistoryProps {
    recordId: string;
    recordType?: string;
}

export function AuditHistory({ recordId, recordType }: AuditHistoryProps) {
    const [history, setHistory] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        loadHistory();
    }, [recordId]);

    const loadHistory = async () => {
        try {
            const data = await getRecordHistory(recordId);
            setHistory(data);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'INSERT': return 'bg-green-100 text-green-700';
            case 'UPDATE': return 'bg-blue-100 text-blue-700';
            case 'DELETE': return 'bg-red-100 text-red-700';
            case 'APPROVE': return 'bg-purple-100 text-purple-700';
            case 'CANCEL': return 'bg-orange-100 text-orange-700';
            case 'PAYMENT': return 'bg-teal-100 text-teal-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (loading) {
        return (
            <div className="text-center py-4 text-gray-500 text-sm">
                Cargando historial...
            </div>
        );
    }

    if (history.length === 0) {
        return null;
    }

    const displayedHistory = expanded ? history : history.slice(0, 3);

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <History size={18} />
                    Historial de Cambios
                </h3>
            </div>
            
            <div className="divide-y divide-gray-100">
                {displayedHistory.map((log, index) => (
                    <div key={log.id || index} className="px-4 py-3 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                            <div className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                                {formatAuditAction(log.action)}
                            </div>
                            <div className="flex-1 min-w-0">
                                {log.description && (
                                    <p className="text-sm text-gray-700">{log.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <User size={12} />
                                        {log.user_email || 'Sistema'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {formatDate(log.created_at)}
                                    </span>
                                </div>
                                
                                {/* Show changed fields for updates */}
                                {log.action === 'UPDATE' && log.old_data && log.new_data && (
                                    <div className="mt-2 text-xs bg-gray-50 rounded p-2">
                                        <span className="font-medium text-gray-600">Cambios:</span>
                                        <div className="mt-1 space-y-0.5">
                                            {Object.keys(log.new_data)
                                                .filter(key => JSON.stringify(log.old_data?.[key]) !== JSON.stringify(log.new_data?.[key]))
                                                .slice(0, 5)
                                                .map(key => (
                                                    <div key={key} className="text-gray-500">
                                                        <span className="font-medium">{key}:</span>{' '}
                                                        <span className="line-through text-red-500">
                                                            {String(log.old_data?.[key] ?? '-')}
                                                        </span>
                                                        {' → '}
                                                        <span className="text-green-600">
                                                            {String(log.new_data?.[key] ?? '-')}
                                                        </span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {history.length > 3 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                >
                    {expanded ? 'Ver menos' : `Ver ${history.length - 3} más`}
                </button>
            )}
        </div>
    );
}
