'use client';

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 9,
        fontFamily: 'Helvetica',
    },
    header: {
        textAlign: 'center',
        marginBottom: 20,
        borderBottom: '1pt solid #333',
        paddingBottom: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 12,
        color: '#666',
        marginBottom: 3,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottom: '2pt solid #333',
        paddingBottom: 5,
        marginBottom: 5,
        fontWeight: 'bold',
        backgroundColor: '#f3f4f6',
        padding: 8,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '0.5pt solid #e5e7eb',
        paddingVertical: 4,
    },
    colName: {
        flex: 1,
    },
    colDoc: {
        width: 80,
    },
    colAmount: {
        width: 70,
        textAlign: 'right',
    },
    totalRow: {
        flexDirection: 'row',
        borderTop: '2pt solid #333',
        paddingTop: 8,
        marginTop: 5,
        fontWeight: 'bold',
        fontSize: 10,
    },
    grandTotal: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#f3f4f6',
        borderRadius: 4,
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
    },
    overdue: {
        color: '#b91c1c',
    },
});

interface ClientReport {
    third_party_id: string;
    third_party_name: string;
    document_number: string;
    total_invoiced: number;
    total_paid: number;
    total_pending: number;
    documents_count: number;
    overdue_amount: number;
    oldest_due_date: string | null;
}

interface CarteraReportPDFProps {
    title: string;
    data: ClientReport[];
    type: 'receivable' | 'payable';
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(value);
};

const CarteraReportDocument = ({ title, data, type }: CarteraReportPDFProps) => {
    const totals = data.reduce((acc, item) => ({
        invoiced: acc.invoiced + item.total_invoiced,
        paid: acc.paid + item.total_paid,
        pending: acc.pending + item.total_pending,
        overdue: acc.overdue + item.overdue_amount,
        count: acc.count + item.documents_count,
    }), { invoiced: 0, paid: 0, pending: 0, overdue: 0, count: 0 });

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.title}>{title.toUpperCase()}</Text>
                    <Text style={styles.subtitle}>HPlus Contable - CFO IA</Text>
                    <Text style={{ fontSize: 10, color: '#888' }}>
                        Generado: {new Date().toLocaleDateString('es-CO')}
                    </Text>
                </View>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={styles.colName}>{type === 'receivable' ? 'Cliente' : 'Proveedor'}</Text>
                    <Text style={styles.colDoc}>NIT/CC</Text>
                    <Text style={styles.colAmount}>Facturado</Text>
                    <Text style={styles.colAmount}>Pagado</Text>
                    <Text style={styles.colAmount}>Pendiente</Text>
                    <Text style={styles.colAmount}>Vencido</Text>
                </View>

                {/* Table Rows */}
                {data.map((item) => (
                    <View key={item.third_party_id} style={styles.tableRow}>
                        <Text style={styles.colName}>{item.third_party_name}</Text>
                        <Text style={styles.colDoc}>{item.document_number}</Text>
                        <Text style={styles.colAmount}>{formatCurrency(item.total_invoiced)}</Text>
                        <Text style={styles.colAmount}>{formatCurrency(item.total_paid)}</Text>
                        <Text style={styles.colAmount}>{formatCurrency(item.total_pending)}</Text>
                        <Text style={item.overdue_amount > 0 ? [styles.colAmount, styles.overdue] : styles.colAmount}>
                            {formatCurrency(item.overdue_amount)}
                        </Text>
                    </View>
                ))}

                {/* Totals */}
                <View style={styles.totalRow}>
                    <Text style={styles.colName}>TOTALES ({data.length} terceros)</Text>
                    <Text style={styles.colDoc}></Text>
                    <Text style={styles.colAmount}>{formatCurrency(totals.invoiced)}</Text>
                    <Text style={styles.colAmount}>{formatCurrency(totals.paid)}</Text>
                    <Text style={styles.colAmount}>{formatCurrency(totals.pending)}</Text>
                    <Text style={totals.overdue > 0 ? [styles.colAmount, styles.overdue] : styles.colAmount}>
                        {formatCurrency(totals.overdue)}
                    </Text>
                </View>

                {/* Summary */}
                <View style={styles.grandTotal}>
                    <View style={styles.grandTotalRow}>
                        <Text style={{ fontWeight: 'bold' }}>Resumen de Cartera</Text>
                    </View>
                    <View style={styles.grandTotalRow}>
                        <Text>Total Documentos:</Text>
                        <Text>{totals.count}</Text>
                    </View>
                    <View style={styles.grandTotalRow}>
                        <Text>Total Facturado:</Text>
                        <Text>{formatCurrency(totals.invoiced)}</Text>
                    </View>
                    <View style={styles.grandTotalRow}>
                        <Text>Total Pagado:</Text>
                        <Text>{formatCurrency(totals.paid)}</Text>
                    </View>
                    <View style={styles.grandTotalRow}>
                        <Text style={{ fontWeight: 'bold' }}>Saldo Pendiente:</Text>
                        <Text style={{ fontWeight: 'bold' }}>{formatCurrency(totals.pending)}</Text>
                    </View>
                    {totals.overdue > 0 && (
                        <View style={styles.grandTotalRow}>
                            <Text style={styles.overdue}>Monto Vencido:</Text>
                            <Text style={styles.overdue}>{formatCurrency(totals.overdue)}</Text>
                        </View>
                    )}
                </View>
            </Page>
        </Document>
    );
};

export async function generateCarteraReportPDF(title: string, data: ClientReport[], type: 'receivable' | 'payable'): Promise<Blob> {
    const blob = await pdf(<CarteraReportDocument title={title} data={data} type={type} />).toBlob();
    return blob;
}

export function downloadCarteraReportPDF(title: string, data: ClientReport[], type: 'receivable' | 'payable', filename: string) {
    generateCarteraReportPDF(title, data, type).then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    });
}
