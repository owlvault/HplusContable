'use client';

import { useState } from 'react';
import { Filter, X, Search } from 'lucide-react';

export interface CarteraFilters {
    dateFrom?: string;
    dateTo?: string;
    status?: 'all' | 'pending' | 'partial' | 'paid' | 'overdue';
    minAmount?: number;
    maxAmount?: number;
    search?: string;
}

interface CarteraFiltersProps {
    filters: CarteraFilters;
    onFiltersChange: (filters: CarteraFilters) => void;
    type: 'receivable' | 'payable';
}

export function CarteraFiltersPanel({ filters, onFiltersChange, type }: CarteraFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleChange = (key: keyof CarteraFilters, value: any) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const clearFilters = () => {
        onFiltersChange({});
    };

    const hasFilters = Object.values(filters).some(v => v !== undefined && v !== '' && v !== 'all');

    return (
        <div className="mb-4">
            {/* Filter Toggle Button */}
            <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder={`Buscar ${type === 'receivable' ? 'cliente' : 'proveedor'} o documento...`}
                        value={filters.search || ''}
                        onChange={(e) => handleChange('search', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        hasFilters 
                            ? 'bg-blue-50 border-blue-300 text-blue-700' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <Filter size={18} />
                    Filtros
                    {hasFilters && (
                        <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                            {Object.values(filters).filter(v => v !== undefined && v !== '' && v !== 'all').length}
                        </span>
                    )}
                </button>
                {hasFilters && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-red-600 transition-colors"
                        title="Limpiar filtros"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Expanded Filters Panel */}
            {isOpen && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Date Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha desde
                            </label>
                            <input
                                type="date"
                                value={filters.dateFrom || ''}
                                onChange={(e) => handleChange('dateFrom', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha hasta
                            </label>
                            <input
                                type="date"
                                value={filters.dateTo || ''}
                                onChange={(e) => handleChange('dateTo', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Estado
                            </label>
                            <select
                                value={filters.status || 'all'}
                                onChange={(e) => handleChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">Todos</option>
                                <option value="pending">Pendiente</option>
                                <option value="partial">Parcial</option>
                                <option value="paid">Pagado</option>
                                <option value="overdue">Vencido</option>
                            </select>
                        </div>

                        {/* Amount Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Monto mínimo
                            </label>
                            <input
                                type="number"
                                placeholder="0"
                                value={filters.minAmount || ''}
                                onChange={(e) => handleChange('minAmount', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Monto máximo
                            </label>
                            <input
                                type="number"
                                placeholder="Sin límite"
                                value={filters.maxAmount || ''}
                                onChange={(e) => handleChange('maxAmount', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Active Filters Tags */}
                    {hasFilters && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                            <span className="text-sm text-gray-500">Filtros activos:</span>
                            {filters.dateFrom && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    Desde: {filters.dateFrom}
                                    <button onClick={() => handleChange('dateFrom', undefined)} className="hover:text-red-600">
                                        <X size={12} />
                                    </button>
                                </span>
                            )}
                            {filters.dateTo && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    Hasta: {filters.dateTo}
                                    <button onClick={() => handleChange('dateTo', undefined)} className="hover:text-red-600">
                                        <X size={12} />
                                    </button>
                                </span>
                            )}
                            {filters.status && filters.status !== 'all' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    Estado: {filters.status}
                                    <button onClick={() => handleChange('status', 'all')} className="hover:text-red-600">
                                        <X size={12} />
                                    </button>
                                </span>
                            )}
                            {filters.minAmount && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    Min: ${filters.minAmount.toLocaleString()}
                                    <button onClick={() => handleChange('minAmount', undefined)} className="hover:text-red-600">
                                        <X size={12} />
                                    </button>
                                </span>
                            )}
                            {filters.maxAmount && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    Max: ${filters.maxAmount.toLocaleString()}
                                    <button onClick={() => handleChange('maxAmount', undefined)} className="hover:text-red-600">
                                        <X size={12} />
                                    </button>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Utility function to apply filters to documents
export function applyCarteraFilters(documents: any[], filters: CarteraFilters): any[] {
    let filtered = [...documents];

    // Search filter
    if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(doc => 
            doc.document_number?.toLowerCase().includes(searchLower) ||
            doc.third_party?.full_name?.toLowerCase().includes(searchLower)
        );
    }

    // Date filters
    if (filters.dateFrom) {
        filtered = filtered.filter(doc => doc.due_date >= filters.dateFrom);
    }
    if (filters.dateTo) {
        filtered = filtered.filter(doc => doc.due_date <= filters.dateTo);
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
        const today = new Date().toISOString().split('T')[0];
        
        filtered = filtered.filter(doc => {
            switch (filters.status) {
                case 'pending':
                    return doc.status === 'PENDING';
                case 'partial':
                    return doc.status === 'PARTIAL';
                case 'paid':
                    return doc.status === 'PAID';
                case 'overdue':
                    return doc.due_date < today && doc.status !== 'PAID';
                default:
                    return true;
            }
        });
    }

    // Amount filters
    if (filters.minAmount !== undefined) {
        filtered = filtered.filter(doc => doc.balance >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
        filtered = filtered.filter(doc => doc.balance <= filters.maxAmount!);
    }

    return filtered;
}
