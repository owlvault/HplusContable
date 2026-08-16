// Module definitions for the system
export const MODULES = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'puc', name: 'Plan de Cuentas', icon: '📖' },
    { id: 'terceros', name: 'Terceros', icon: '👥' },
    { id: 'ventas', name: 'Ventas', icon: '🎯' },
    { id: 'proyectos', name: 'Proyectos', icon: '📐' },
    { id: 'facturas', name: 'Facturación', icon: '🧾' },
    { id: 'cartera', name: 'Cartera', icon: '💰' },
    { id: 'tesoreria', name: 'Tesorería', icon: '🏦' },
    { id: 'nomina', name: 'Nómina', icon: '💼' },
    { id: 'asientos', name: 'Asientos', icon: '📝' },
    { id: 'comprobantes', name: 'Comprobantes', icon: '📋' },
    { id: 'reportes', name: 'Reportes', icon: '📈' },
    { id: 'cierre', name: 'Cierre Contable', icon: '🔒' },
    { id: 'conciliacion', name: 'Conciliación', icon: '🔄' },
    { id: 'configuracion', name: 'Configuración', icon: '⚙️' },
    { id: 'usuarios', name: 'Usuarios', icon: '👤' },
] as const;

export type ModuleId = typeof MODULES[number]['id'];
