'use client';

import { useState, useMemo } from 'react';
import { CarteraFiltersPanel, CarteraFilters, applyCarteraFilters } from './cartera-filters';
import { DocumentsTable } from './documents-table';

interface FilteredDocumentsProps {
    documents: any[];
    type: 'receivable' | 'payable';
    title: string;
}

export function FilteredDocuments({ documents, type, title }: FilteredDocumentsProps) {
    const [filters, setFilters] = useState<CarteraFilters>({});

    const filteredDocuments = useMemo(() => {
        return applyCarteraFilters(documents, filters);
    }, [documents, filters]);

    const totalFiltered = filteredDocuments.length;
    const totalOriginal = documents.length;

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                {totalFiltered !== totalOriginal && (
                    <span className="text-sm text-gray-500">
                        Mostrando {totalFiltered} de {totalOriginal}
                    </span>
                )}
            </div>
            
            <CarteraFiltersPanel 
                filters={filters}
                onFiltersChange={setFilters}
                type={type}
            />
            
            <DocumentsTable documents={filteredDocuments} type={type} />
        </div>
    );
}
