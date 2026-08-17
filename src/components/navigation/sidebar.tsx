'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Sparkles,
    FileText,
    Receipt,
    Wallet,
    Building2,
    Users,
    BookOpen,
    FileSpreadsheet,
    Scale,
    Lock,
    RefreshCw,
    Briefcase,
    Settings,
    Shield,
    ChevronRight,
    TrendingUp,
} from 'lucide-react';
import { UserMenu } from '@/components/ui/user-menu';
import { NotificationBell } from '@/components/ui/notification-bell';

interface SidebarProps {
    userName?: string;
}

export function Sidebar({ userName }: SidebarProps) {
    const pathname = usePathname();

    const commercialNav = [
        {
            href: '/ventas',
            label: 'Ventas & Flujo Guiado',
            icon: Sparkles,
            badge: 'Asistido',
            highlight: true,
        },
        { href: '/facturas', label: 'Facturación DIAN', icon: Receipt },
        { href: '/cartera', label: 'Cartera & Cobros', icon: Wallet },
        { href: '/tesoreria', label: 'Tesorería & Bancos', icon: Building2 },
        { href: '/terceros', label: 'Terceros / Clientes', icon: Users },
    ];

    const accountingNav = [
        { href: '/puc', label: 'Plan de Cuentas (PUC)', icon: BookOpen },
        { href: '/asientos', label: 'Libro Diario & Asientos', icon: FileSpreadsheet },
        { href: '/comprobantes', label: 'Comprobantes', icon: FileText },
        { href: '/nomina', label: 'Nómina Electrónica', icon: Briefcase },
        { href: '/conciliacion', label: 'Conciliación Bancaria', icon: RefreshCw },
        { href: '/reportes', label: 'Balances & Reportes', icon: Scale },
        { href: '/cierre', label: 'Cierre Contable', icon: Lock },
    ];

    const configNav = [
        { href: '/usuarios', label: 'Usuarios y Roles', icon: Shield },
        { href: '/configuracion', label: 'Configuración', icon: Settings },
    ];

    return (
        <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 p-4 fixed h-full flex flex-col justify-between z-30 select-none overflow-y-auto">
            <div className="space-y-6">
                {/* Brand Logo */}
                <Link href="/dashboard" className="flex items-center gap-3 px-2 py-1 group">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-600/30 group-hover:scale-105 transition">
                        H+
                    </div>
                    <div>
                        <div className="font-extrabold text-white text-base tracking-tight leading-none group-hover:text-blue-400 transition">
                            HPlus Contable
                        </div>
                        <div className="text-[11px] font-semibold text-blue-400 flex items-center gap-1 mt-1">
                            <Sparkles className="w-3 h-3" />
                            CFO IA & DIAN
                        </div>
                    </div>
                </Link>

                {/* Dashboard Home */}
                <div>
                    <Link
                        href="/dashboard"
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                            pathname === '/dashboard'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Panel Principal</span>
                    </Link>
                </div>

                {/* Section 1: Flujo Comercial */}
                <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-3">
                        Operación Comercial
                    </div>
                    {commercialNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                                    isActive
                                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                    <span>{item.label}</span>
                                </div>
                                {item.badge && (
                                    <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            isActive
                                                ? 'bg-white/20 text-white'
                                                : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                                        }`}
                                    >
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Section 2: Auditor Lens & Contabilidad */}
                <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-3">
                        Contabilidad & NIIF
                    </div>
                    {accountingNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition ${
                                    isActive
                                        ? 'bg-blue-600 text-white font-bold shadow-md'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Section 3: Administración */}
                <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-3">
                        Sistema
                    </div>
                    {configNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition ${
                                    isActive
                                        ? 'bg-blue-600 text-white font-bold shadow-md'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* User footer */}
            <div className="pt-4 mt-6 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                    <NotificationBell />
                    <UserMenu userName={userName} />
                </div>
            </div>
        </aside>
    );
}
