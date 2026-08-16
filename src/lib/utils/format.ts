// Formateo con convenciones colombianas, compartido por el módulo de ventas.

export function formatCurrency(value: number | null | undefined, currency = 'COP'): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);
}

/** Abrevia montos grandes para las tarjetas de indicadores. */
export function formatCompact(value: number | null | undefined, currency = 'COP'): string {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    const symbol = currency === 'COP' ? '$' : `${currency} `;

    if (abs >= 1_000_000_000) return `${symbol}${(n / 1_000_000_000).toFixed(1)} MM`;
    if (abs >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)} M`;
    if (abs >= 1_000) return `${symbol}${(n / 1_000).toFixed(0)} K`;
    return formatCurrency(n, currency);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
    return `${(Number(value) || 0).toFixed(decimals)}%`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(Number(value) || 0);
}

export function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
}

/**
 * Color del margen según umbrales de una fábrica de software.
 * Verde sobre 45%, ámbar entre 30 y 45, rojo por debajo.
 */
export function marginColorClass(rate: number | null | undefined): string {
    const value = Number(rate) || 0;
    if (value >= 45) return 'text-green-600';
    if (value >= 30) return 'text-amber-600';
    return 'text-red-600';
}

export function marginBadgeClass(rate: number | null | undefined): string {
    const value = Number(rate) || 0;
    if (value >= 45) return 'bg-green-50 text-green-700 border-green-200';
    if (value >= 30) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
}
