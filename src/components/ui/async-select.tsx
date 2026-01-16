'use client';

import { useState, useEffect, useRef } from 'react';

type Option = {
    label: string;
    value: string;
    subLabel?: string;
};

type AsyncSelectProps = {
    loadOptions: (search: string) => Promise<any[]>;
    mapOption: (item: any) => Option;
    onChange: (value: Option | null) => void;
    placeholder?: string;
    value?: Option | null;
};

export function AsyncSelect({ loadOptions, mapOption, onChange, placeholder = 'Buscar...', value }: AsyncSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<Option[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            setLoading(true);
            loadOptions(search)
                .then(items => {
                    setOptions(items.map(mapOption));
                })
                .finally(() => setLoading(false));
        }, 300);

        return () => clearTimeout(timer);
    }, [search, isOpen, loadOptions, mapOption]);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '0.625rem',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'hsl(var(--surface))',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '42px'
                }}
            >
                <span style={{ color: value ? 'hsl(var(--text-main))' : 'hsl(var(--text-secondary))' }}>
                    {value ? value.label : placeholder}
                </span>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>▼</span>
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 50,
                    maxHeight: '250px',
                    overflowY: 'auto'
                }}>
                    <input
                        autoFocus
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Escribe para buscar..."
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: 'none',
                            borderBottom: '1px solid hsl(var(--border))',
                            outline: 'none',
                            backgroundColor: 'transparent'
                        }}
                    />

                    {loading ? (
                        <div style={{ padding: '1rem', color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>Cargando...</div>
                    ) : options.length === 0 ? (
                        <div style={{ padding: '1rem', color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>No se encontraron resultados</div>
                    ) : (
                        options.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => {
                                    onChange(option);
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                                style={{
                                    padding: '0.75rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid hsl(var(--border))',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--surface-hover))'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <span style={{ fontWeight: 500 }}>{option.label}</span>
                                {option.subLabel && (
                                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>{option.subLabel}</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
