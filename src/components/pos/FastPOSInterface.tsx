'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Search,
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    CreditCard,
    DollarSign,
    QrCode,
    Wifi,
    WifiOff,
    CheckCircle2,
    User,
} from 'lucide-react';

export interface POSItem {
    id: string;
    sku: string;
    barcode?: string;
    name: string;
    price: number;
    unitCost: number;
    taxRate: number;
    category?: string;
}

export interface POSCartLine {
    product: POSItem;
    quantity: number;
    unitPrice: number;
    discount: number;
}

export interface FastPOSProps {
    terminalId?: string;
    leasedRangeText?: string;
    isOffline?: boolean;
    onCompleteSale?: (saleData: Record<string, unknown>) => Promise<void>;
}

const SAMPLE_PRODUCTS: POSItem[] = [
    { id: '1', sku: 'CAF-500', name: 'Café Especial Colombia 500g', price: 28000, unitCost: 15000, taxRate: 19, category: 'Bebidas' },
    { id: '2', sku: 'PAN-001', name: 'Pan Artesanal Masa Madre', price: 8500, unitCost: 4000, taxRate: 0, category: 'Panadería' },
    { id: '3', sku: 'LEC-ALM', name: 'Leche de Almendras 1L', price: 14000, unitCost: 8500, taxRate: 0, category: 'Lácteos' },
    { id: '4', sku: 'CHO-70', name: 'Chocolate Orgánico 70% Cacao', price: 12500, unitCost: 6800, taxRate: 5, category: 'Dulces' },
    { id: '5', sku: 'AGU-GAS', name: 'Agua Mineral con Gas 300ml', price: 4500, unitCost: 2000, taxRate: 19, category: 'Bebidas' },
];

export const FastPOSInterface: React.FC<FastPOSProps> = ({
    terminalId = 'CAJA-01',
    leasedRangeText = 'Bloque Leased: 1001-1050',
    isOffline = false,
    onCompleteSale,
}) => {
    const [cart, setCart] = useState<POSCartLine[]>([
        { product: SAMPLE_PRODUCTS[0], quantity: 2, unitPrice: SAMPLE_PRODUCTS[0].price, discount: 0 },
        { product: SAMPLE_PRODUCTS[1], quantity: 1, unitPrice: SAMPLE_PRODUCTS[1].price, discount: 0 },
    ]);
    const [searchQuery, setSearchQuery] = useState('');
    const [clientName, setClientName] = useState('Consumidor Final (222222222)');
    const [isElectrónica, setIsElectrónica] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [completedSale, setCompletedSale] = useState<Record<string, unknown> | null>(null);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Cálculos de totales en tiempo real
    const subtotal = cart.reduce((acc, line) => acc + line.quantity * line.unitPrice, 0);
    const totalTax = cart.reduce((acc, line) => {
        const lineSub = line.quantity * line.unitPrice;
        return acc + (lineSub * line.product.taxRate) / 100;
    }, 0);
    const total = subtotal + totalTax;

    const handleQuickCash = useCallback(async () => {
        if (cart.length === 0) return;
        setIsCheckingOut(true);
        const sale = {
            terminalId,
            timestamp: new Date().toISOString(),
            itemsCount: cart.length,
            total,
            paymentMethod: 'EFECTIVO_EXACTO',
            isElectronic: isElectrónica,
        };

        if (onCompleteSale) {
            await onCompleteSale(sale);
        }

        setTimeout(() => {
            setCompletedSale(sale);
            setIsCheckingOut(false);
            setCart([]);
        }, 300);
    }, [cart, isElectrónica, onCompleteSale, terminalId, total]);

    const handleCheckout = useCallback(() => {
        handleQuickCash();
    }, [handleQuickCash]);

    // Atajos de teclado universales (F2-F10)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2' || (e.key === '/' && document.activeElement !== searchInputRef.current)) {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'F8' || (e.key === ' ' && e.ctrlKey)) {
                e.preventDefault();
                handleCheckout();
            } else if (e.key === 'F9') {
                e.preventDefault();
                handleQuickCash();
            } else if (e.key === 'F10') {
                e.preventDefault();
                setIsElectrónica((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleCheckout, handleQuickCash]);

    const addToCart = (product: POSItem) => {
        setCart((prev) => {
            const existing = prev.find((l) => l.product.id === product.id);
            if (existing) {
                return prev.map((l) =>
                    l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
                );
            }
            return [...prev, { product, quantity: 1, unitPrice: product.price, discount: 0 }];
        });
    };

    const updateQty = (productId: string, delta: number) => {
        setCart((prev) =>
            prev
                .map((l) => {
                    if (l.product.id === productId) {
                        const newQty = l.quantity + delta;
                        return newQty > 0 ? { ...l, quantity: newQty } : null;
                    }
                    return l;
                })
                .filter(Boolean) as POSCartLine[]
        );
    };

    const removeLine = (productId: string) => {
        setCart((prev) => prev.filter((l) => l.product.id !== productId));
    };

    const handleChangeClient = () => {
        const customName = prompt('Nombre o identificación del cliente:', clientName);
        if (customName) setClientName(customName);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 min-h-[680px] bg-background text-foreground">
            {/* Panel Izquierdo: Catálogo y Búsqueda Rápida */}
            <div className="flex-1 flex flex-col gap-4">
                {/* Banner de Venta Exitosa */}
                {completedSale && (
                    <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700 shadow-sm animate-fade-in">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span className="text-sm font-semibold">
                                ¡Venta completada con éxito! Total cobrado: ${Number(completedSale.total).toLocaleString('es-CO')} COP
                            </span>
                        </div>
                        <button
                            onClick={() => setCompletedSale(null)}
                            className="text-xs font-semibold underline cursor-pointer"
                        >
                            Cerrar
                        </button>
                    </div>
                )}

                {/* Barra Superior con Estado POS */}
                <div className="flex items-center justify-between p-3.5 bg-card border rounded-xl shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            {terminalId}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground border px-2 py-1 rounded-lg">
                            {leasedRangeText}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsElectrónica(!isElectrónica)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                isElectrónica
                                    ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            <QrCode className="w-3.5 h-3.5" />
                            {isElectrónica ? 'Factura Electrónica (F10)' : 'Ticket POS (F10)'}
                        </button>

                        <div
                            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                                isOffline ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'
                            }`}
                        >
                            {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                            {isOffline ? 'Offline' : 'Online'}
                        </div>
                    </div>
                </div>

                {/* Buscador Rápido */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Buscar producto por nombre, SKU o código de barras (F2 o /)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-20 py-2.5 rounded-xl border bg-card text-foreground text-sm focus:outline-hidden focus:ring-2 focus:ring-primary shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border">
                        F2
                    </span>
                </div>

                {/* Grid de Productos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 overflow-y-auto max-h-[500px] p-1">
                    {SAMPLE_PRODUCTS.filter(
                        (p) =>
                            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.sku.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map((prod) => (
                        <button
                            key={prod.id}
                            onClick={() => addToCart(prod)}
                            className="flex flex-col justify-between p-3.5 rounded-xl border bg-card hover:border-primary hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                            <div>
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                                    {prod.category}
                                </span>
                                <h4 className="text-sm font-semibold text-foreground line-clamp-2 mt-0.5 group-hover:text-primary transition-colors">
                                    {prod.name}
                                </h4>
                            </div>

                            <div className="mt-3 flex items-center justify-between pt-2 border-t">
                                <span className="text-xs font-mono text-muted-foreground">IVA {prod.taxRate}%</span>
                                <span className="text-sm font-bold text-foreground">
                                    ${prod.price.toLocaleString('es-CO')}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Atajos de Teclado Footer */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
                    <span className="font-semibold text-foreground">Atajos:</span>
                    <span className="bg-background px-1.5 py-0.5 rounded border font-mono">F2: Buscar</span>
                    <span className="bg-background px-1.5 py-0.5 rounded border font-mono">F8: Cobro</span>
                    <span className="bg-background px-1.5 py-0.5 rounded border font-mono">F9: Efectivo Rápido</span>
                    <span className="bg-background px-1.5 py-0.5 rounded border font-mono">F10: Alternar DIAN</span>
                </div>
            </div>

            {/* Panel Derecho: Ticket de Venta Actual */}
            <div className="w-full lg:w-[420px] flex flex-col justify-between p-5 rounded-2xl border bg-card shadow-sm">
                <div className="flex flex-col gap-4">
                    {/* Encabezado del Ticket */}
                    <div className="flex items-center justify-between pb-3 border-b">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-primary" />
                            <h3 className="font-bold text-base text-foreground">Venta Actual</h3>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {cart.reduce((a, b) => a + b.quantity, 0)} ítems
                        </span>
                    </div>

                    {/* Cliente Asignado */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="w-4 h-4" />
                            <span className="font-medium text-foreground truncate max-w-[200px]">
                                {clientName}
                            </span>
                        </div>
                        <button
                            onClick={handleChangeClient}
                            className="text-primary hover:underline font-semibold cursor-pointer"
                        >
                            Cambiar (F3)
                        </button>
                    </div>

                    {/* Líneas del Carrito */}
                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[260px] pr-1">
                        {cart.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground text-sm">
                                El carrito está vacío. Escanea o selecciona productos.
                            </div>
                        ) : (
                            cart.map((line) => (
                                <div
                                    key={line.product.id}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-background border text-xs gap-2"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-foreground truncate">
                                            {line.product.name}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">
                                            ${line.unitPrice.toLocaleString('es-CO')} c/u
                                        </div>
                                    </div>

                                    {/* Controles de Cantidad */}
                                    <div className="flex items-center gap-1.5 bg-muted rounded-md p-0.5">
                                        <button
                                            onClick={() => updateQty(line.product.id, -1)}
                                            className="p-1 hover:bg-background rounded cursor-pointer"
                                        >
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-5 text-center font-bold">{line.quantity}</span>
                                        <button
                                            onClick={() => updateQty(line.product.id, 1)}
                                            className="p-1 hover:bg-background rounded cursor-pointer"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <span className="font-bold text-foreground w-16 text-right">
                                        ${(line.quantity * line.unitPrice).toLocaleString('es-CO')}
                                    </span>

                                    <button
                                        onClick={() => removeLine(line.product.id)}
                                        className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Resumen y Acciones de Cobro */}
                <div className="pt-4 border-t flex flex-col gap-3 mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span>
                        <span>${subtotal.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Impuestos (IVA)</span>
                        <span>${totalTax.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between text-lg font-black text-foreground pt-2 border-t">
                        <span>TOTAL A COBRAR</span>
                        <span className="text-primary">${total.toLocaleString('es-CO')} COP</span>
                    </div>

                    {/* Botones de Cobro en 1 Clic */}
                    <div className="grid grid-cols-2 gap-2.5 mt-2">
                        <button
                            onClick={handleQuickCash}
                            disabled={cart.length === 0 || isCheckingOut}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <DollarSign className="w-4 h-4" />
                            Efectivo Exacto (F9)
                        </button>

                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || isCheckingOut}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <CreditCard className="w-4 h-4" />
                            Cobrar / Datáfono (F8)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
