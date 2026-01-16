'use client';

import { useState, useEffect } from 'react';
import { detectAnomalies } from '@/actions/anomalies';

type Anomaly = {
    type: 'warning' | 'error' | 'info';
    title: string;
    description: string;
    suggestion?: string;
};

const typeStyles = {
    error: {
        bg: 'hsl(var(--error)/0.1)',
        border: 'hsl(var(--error)/0.3)',
        icon: '⚠️',
        color: 'hsl(var(--error))'
    },
    warning: {
        bg: 'hsl(var(--gold)/0.1)',
        border: 'hsl(var(--gold)/0.3)',
        icon: '⚡',
        color: 'hsl(45 80% 35%)'
    },
    info: {
        bg: 'hsl(var(--accent)/0.1)',
        border: 'hsl(var(--accent)/0.3)',
        icon: '✅',
        color: 'hsl(var(--accent))'
    }
};

export function AnomaliesPanel() {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAnomalies();
    }, []);

    const loadAnomalies = async () => {
        setLoading(true);
        try {
            const data = await detectAnomalies();
            setAnomalies(data);
        } catch (error) {
            console.error('Error detecting anomalies:', error);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                Analizando datos contables...
            </div>
        );
    }

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>🔍 Detección de Anomalías</h3>
                <button
                    onClick={loadAnomalies}
                    style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'transparent',
                        cursor: 'pointer'
                    }}
                >
                    Actualizar
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {anomalies.map((anomaly, index) => {
                    const style = typeStyles[anomaly.type];
                    return (
                        <div
                            key={index}
                            style={{
                                padding: '0.75rem',
                                backgroundColor: style.bg,
                                border: `1px solid ${style.border}`,
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <span>{style.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, fontSize: '0.875rem', color: style.color, marginBottom: '0.25rem' }}>
                                        {anomaly.title}
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: 'hsl(var(--text-main))', marginBottom: anomaly.suggestion ? '0.5rem' : 0 }}>
                                        {anomaly.description}
                                    </div>
                                    {anomaly.suggestion && (
                                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontStyle: 'italic' }}>
                                            💡 {anomaly.suggestion}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
