'use client';

import { useState } from 'react';
import { 
    getReceivablesReportByClient, 
    getPayablesReportBySupplier, 
    getTrialBalance, 
    getBalanceSheet, 
    getIncomeStatement 
} from '@/actions/reportes';
import { CarteraReport } from '@/components/reportes/cartera-report';
import { BalanceSheet } from '@/components/reportes/balance-sheet';
import { IncomeStatement } from '@/components/reportes/income-statement';
import { TrialBalance } from '@/components/reportes/trial-balance';
import { FileText, Users, Building2, BarChart3, PieChart, Loader2, Printer } from 'lucide-react';

type ReportType = 'cartera-clientes' | 'cartera-proveedores' | 'balance-comprobacion' | 'balance-general' | 'estado-resultados';

export default function ReportesPage() {
    const [reportType, setReportType] = useState<ReportType>('cartera-clientes');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);

    const reportOptions = [
        { id: 'cartera-clientes', label: 'Cartera por Clientes', icon: Users, description: 'Cuentas por cobrar agrupadas por cliente' },
        { id: 'cartera-proveedores', label: 'Cartera por Proveedores', icon: Building2, description: 'Cuentas por pagar agrupadas por proveedor' },
        { id: 'balance-comprobacion', label: 'Balance de Comprobación', icon: BarChart3, description: 'Sumas y saldos de todas las cuentas' },
        { id: 'balance-general', label: 'Balance General', icon: FileText, description: 'Estado de Situación Financiera' },
        { id: 'estado-resultados', label: 'Estado de Resultados', icon: PieChart, description: 'Ingresos, gastos y utilidad del período' },
    ];

    const months = [
        { value: 1, label: 'Enero' },
        { value: 2, label: 'Febrero' },
        { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' },
        { value: 5, label: 'Mayo' },
        { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' },
        { value: 8, label: 'Agosto' },
        { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' },
        { value: 11, label: 'Noviembre' },
        { value: 12, label: 'Diciembre' },
    ];

    const loadReport = async () => {
        setLoading(true);
        setReportData(null);
        
        try {
            let data;
            switch (reportType) {
                case 'cartera-clientes':
                    data = await getReceivablesReportByClient();
                    break;
                case 'cartera-proveedores':
                    data = await getPayablesReportBySupplier();
                    break;
                case 'balance-comprobacion':
                    data = await getTrialBalance(year, month);
                    break;
                case 'balance-general':
                    data = await getBalanceSheet(year, month);
                    break;
                case 'estado-resultados':
                    data = await getIncomeStatement(year, month);
                    break;
            }
            setReportData(data);
        } catch (error) {
            console.error('Error loading report:', error);
            alert('Error al cargar el reporte');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const getPeriodString = () => {
        const monthName = months.find(m => m.value === month)?.label || '';
        return `${monthName} ${year}`;
    };

    const needsPeriod = ['balance-comprobacion', 'balance-general', 'estado-resultados'].includes(reportType);

    return (
        <div data-testid="reportes-page">
            <div className="mb-6 print:hidden">
                <h1 className="text-2xl font-bold text-gray-900">Reportes Financieros</h1>
                <p className="text-gray-500 mt-1">Genera reportes contables y de cartera</p>
            </div>

            {/* Report Selection */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 print:hidden">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Selecciona un Reporte</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
                    {reportOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => { setReportType(option.id as ReportType); setReportData(null); }}
                            className={`p-4 rounded-lg border-2 text-left transition-all ${
                                reportType === option.id 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <option.icon className={`mb-2 ${reportType === option.id ? 'text-blue-600' : 'text-gray-400'}`} size={24} />
                            <p className={`font-medium text-sm ${reportType === option.id ? 'text-blue-900' : 'text-gray-900'}`}>
                                {option.label}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                        </button>
                    ))}
                </div>

                {/* Period Selection (for financial reports) */}
                {needsPeriod && (
                    <div className="flex flex-wrap gap-4 items-end mb-6 p-4 bg-gray-50 rounded-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                            <select
                                value={year}
                                onChange={(e) => setYear(parseInt(e.target.value))}
                                className="px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                {[2024, 2025, 2026].map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                            <select
                                value={month}
                                onChange={(e) => setMonth(parseInt(e.target.value))}
                                className="px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                {months.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={loadReport}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        data-testid="generate-report-btn"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Generando...
                            </>
                        ) : (
                            <>
                                <FileText size={18} />
                                Generar Reporte
                            </>
                        )}
                    </button>
                    
                    {reportData && (
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                            <Printer size={18} />
                            Imprimir
                        </button>
                    )}
                </div>
            </div>

            {/* Report Display */}
            {reportData && (
                <div className="print:m-0">
                    {reportType === 'cartera-clientes' && (
                        <CarteraReport 
                            title="Reporte de Cartera por Clientes" 
                            data={reportData} 
                            type="receivable" 
                        />
                    )}
                    
                    {reportType === 'cartera-proveedores' && (
                        <CarteraReport 
                            title="Reporte de Cartera por Proveedores" 
                            data={reportData} 
                            type="payable" 
                        />
                    )}
                    
                    {reportType === 'balance-comprobacion' && (
                        <TrialBalance 
                            data={reportData} 
                            period={getPeriodString()} 
                        />
                    )}
                    
                    {reportType === 'balance-general' && (
                        <BalanceSheet 
                            {...reportData} 
                            period={`Al ${new Date(year, month, 0).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`} 
                        />
                    )}
                    
                    {reportType === 'estado-resultados' && (
                        <IncomeStatement 
                            {...reportData} 
                            period={getPeriodString()} 
                        />
                    )}
                </div>
            )}

            {/* Empty State */}
            {!reportData && !loading && (
                <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center print:hidden">
                    <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                    <p className="text-gray-500">Selecciona un tipo de reporte y haz clic en "Generar Reporte"</p>
                </div>
            )}
        </div>
    );
}
