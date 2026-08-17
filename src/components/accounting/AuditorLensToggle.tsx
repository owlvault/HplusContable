'use client';

import React, { useState } from 'react';
import { Eye, ShieldCheck, HelpCircle } from 'lucide-react';

export interface AuditorLensToggleProps {
    isAuditorMode?: boolean;
    onToggle?: (enabled: boolean) => void;
    userRole?: string;
    className?: string;
}

export const AuditorLensToggle: React.FC<AuditorLensToggleProps> = ({
    isAuditorMode = false,
    onToggle,
    userRole: _userRole = 'ACCOUNTANT',
    className = '',
}) => {
    const [enabled, setEnabled] = useState(isAuditorMode);

    const handleToggle = () => {
        const nextState = !enabled;
        setEnabled(nextState);
        onToggle?.(nextState);
    };

    return (
        <div
            className={`inline-flex items-center gap-3 p-1.5 px-3 rounded-full border bg-background/80 backdrop-blur-sm shadow-xs transition-all ${
                enabled
                    ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-muted'
            } ${className}`}
        >
            <div className="flex items-center gap-2">
                <div
                    className={`p-1 rounded-full transition-colors ${
                        enabled
                            ? 'bg-indigo-600 text-white'
                            : 'bg-muted text-muted-foreground'
                    }`}
                >
                    {enabled ? (
                        <ShieldCheck className="w-3.5 h-3.5" />
                    ) : (
                        <Eye className="w-3.5 h-3.5" />
                    )}
                </div>

                <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-foreground select-none">
                            {enabled ? 'Auditor Lens Activo' : 'Vista Comercial'}
                        </span>
                        <span
                            title={
                                enabled
                                    ? 'Mostrando cuentas PUC, débitos/créditos, asientos de partida doble y cierres contables.'
                                    : 'Modo simplificado Zero-Jargon para ventas, compras y cobros sin tecnicismos contables.'
                            }
                            className="cursor-help text-muted-foreground hover:text-foreground"
                        >
                            <HelpCircle className="w-3 h-3" />
                        </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-none">
                        {enabled ? 'Modo Contador (NIIF/PUC)' : 'Zero-Accounting Jargon'}
                    </span>
                </div>
            </div>

            {/* Switch Toggle Button */}
            <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={handleToggle}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    enabled ? 'bg-indigo-600' : 'bg-input'
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                        enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                />
            </button>
        </div>
    );
};
