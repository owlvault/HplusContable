'use client';

import React from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    CreditCard,
    FileSpreadsheet,
    PackageX,
    WifiOff,
    ArrowRight,
} from 'lucide-react';

export type ActionCardType =
    | 'DIAN_TIMEOUT_CONTINGENCY_04'
    | 'REGIMEN_SIMPLE_EXEMPTION'
    | 'GATEWAY_SETTLEMENT_N_1'
    | 'OFFLINE_STOCK_ANOMALY'
    | 'POS_OFFLINE_ACTIVE'
    | 'CONTINGENCY_03_TRANSCRIPTION';

export interface ActionCardButton {
    label: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger';
    onClick: () => void | Promise<void>;
    disabled?: boolean;
}

export interface ActionCardProps {
    type: ActionCardType;
    title?: string;
    description?: string;
    badgeText?: string;
    actions: ActionCardButton[];
    metadata?: Record<string, string | number>;
    className?: string;
}

const CARD_CONFIGS: Record<
    ActionCardType,
    {
        icon: React.ComponentType<{ className?: string }>;
        badgeColor: string;
        defaultTitle: string;
        defaultDescription: string;
        defaultBadge: string;
    }
> = {
    DIAN_TIMEOUT_CONTINGENCY_04: {
        icon: Clock,
        badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700',
        defaultBadge: 'Modo Contingencia Tipo 04 Activo',
        defaultTitle: 'Respuesta lenta en servidores de la DIAN',
        defaultDescription:
            'Tu venta quedó registrada legalmente con comprobante provisional. El sistema validará con la DIAN en segundo plano automáticamente.',
    },
    REGIMEN_SIMPLE_EXEMPTION: {
        icon: CheckCircle2,
        badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700',
        defaultBadge: 'Proveedor Régimen Simple Identificado',
        defaultTitle: 'Exoneración Legal de Retenciones (Art. 911 E.T.)',
        defaultDescription:
            'Este proveedor pertenece al Régimen Simple. Por ley, NO se le debe practicar Retención en la Fuente ni ReteICA. Retenciones ajustadas a $0.',
    },
    GATEWAY_SETTLEMENT_N_1: {
        icon: CreditCard,
        badgeColor: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700',
        defaultBadge: 'Depósito de Pasarela Identificado',
        defaultTitle: 'Liquidación Agrupada de Datáfono / Pasarela (N:1)',
        defaultDescription:
            'Se identificó 1 abono en tu banco que agrupa múltiples ventas con datáfono menos comisiones de pasarela. Puedes conciliar todas en 1 clic.',
    },
    OFFLINE_STOCK_ANOMALY: {
        icon: PackageX,
        badgeColor: 'bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-700',
        defaultBadge: 'Sincronización Offline: Saldo Transitorio',
        defaultTitle: 'Ventas Offline con Inventario en Negativo',
        defaultDescription:
            'Se recibieron ventas registradas sin internet. El sistema mantuvo la venta activa y sugiere realizar un ajuste de inventario o conteo físico.',
    },
    POS_OFFLINE_ACTIVE: {
        icon: WifiOff,
        badgeColor: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-700',
        defaultBadge: 'Trabajando Sin Conexión (POS Offline)',
        defaultTitle: 'Terminal en Modo Autónomo Seguro',
        defaultDescription:
            'Sin conexión a internet. Facturando con bloque reservado exclusivo. Cero riesgo de duplicidad de números.',
    },
    CONTINGENCY_03_TRANSCRIPTION: {
        icon: FileSpreadsheet,
        badgeColor: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700',
        defaultBadge: 'Módulo de Ingesta Talonario de Papel (TC)',
        defaultTitle: 'Transcripción de Facturas de Contingencia',
        defaultDescription:
            'Transcribe las facturas físicas emitidas durante la falla de energía para transmitirlas a la DIAN dentro del plazo legal de 48 horas.',
    },
};

export const ActionCard: React.FC<ActionCardProps> = ({
    type,
    title,
    description,
    badgeText,
    actions,
    metadata,
    className = '',
}) => {
    const config = CARD_CONFIGS[type] || {
        icon: AlertTriangle,
        badgeColor: 'bg-gray-100 text-gray-800 border-gray-300',
        defaultBadge: 'Aviso del Sistema',
        defaultTitle: 'Acción Requerida',
        defaultDescription: 'Se requiere atención para continuar con la operación.',
    };

    const Icon = config.icon;

    return (
        <div
            className={`p-5 rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:shadow-md ${className}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <span
                            className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border mb-1.5 ${config.badgeColor}`}
                        >
                            {badgeText || config.defaultBadge}
                        </span>
                        <h4 className="text-base font-semibold leading-tight text-foreground">
                            {title || config.defaultTitle}
                        </h4>
                    </div>
                </div>
            </div>

            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {description || config.defaultDescription}
            </p>

            {metadata && Object.keys(metadata).length > 0 && (
                <div className="mt-3.5 p-3 rounded-lg bg-muted/60 text-xs font-mono grid grid-cols-2 gap-2 border">
                    {Object.entries(metadata).map(([key, val]) => (
                        <div key={key} className="flex flex-col">
                            <span className="text-muted-foreground uppercase text-[10px] tracking-wider">
                                {key}
                            </span>
                            <span className="font-semibold text-foreground truncate">{val}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 pt-3 border-t flex flex-wrap items-center gap-2.5">
                {actions.map((act, idx) => {
                    const isPrimary = act.variant === 'primary' || (!act.variant && idx === 0);
                    const isDanger = act.variant === 'danger';
                    const isOutline = act.variant === 'outline';

                    return (
                        <button
                            key={idx}
                            onClick={act.onClick}
                            disabled={act.disabled}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                isPrimary
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                                    : isDanger
                                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                    : isOutline
                                    ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {act.label}
                            {isPrimary && <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
