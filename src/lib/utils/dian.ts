
/**
 * Calcula el Dígito de Verificación (DV) para un NIT colombiano.
 * Basado en la tabla de primos oficial de la DIAN.
 * @param nit El NIT sin puntos, guiones ni DV.
 * @returns El número del dígito de verificación (0-9).
 */
export function calculateDV(nit: string): number {
    const vpri = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    let x = 0;
    let y = 0;
    let z = nit.length;

    // Limpiar el NIT de caracteres no numéricos
    const cleanNit = nit.replace(/\D/g, '');

    if (!cleanNit || cleanNit.length === 0) return 0;

    for (let i = 0; i < z; i++) {
        y = parseInt(cleanNit.substr(i, 1));
        x += (y * vpri[z - i - 1]);
    }

    y = x % 11;

    return (y > 1) ? 11 - y : y;
}

/**
 * Formatea un valor numérico como moneda colombiana (COP).
 */
export function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}
