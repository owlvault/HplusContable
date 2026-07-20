'use client';

import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { InvoiceWithDetails } from '@/types/invoices';

// Register fonts (using default for now)
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        paddingBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#2563eb',
    },
    companyInfo: {
        flex: 1,
    },
    companyName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 5,
    },
    companyDetail: {
        fontSize: 9,
        color: '#6b7280',
        marginBottom: 2,
    },
    invoiceInfo: {
        textAlign: 'right',
    },
    invoiceTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2563eb',
        marginBottom: 5,
    },
    invoiceNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 10,
    },
    invoiceDate: {
        fontSize: 9,
        color: '#6b7280',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 8,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    clientInfo: {
        backgroundColor: '#f9fafb',
        padding: 12,
        borderRadius: 4,
    },
    clientName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    clientDetail: {
        fontSize: 9,
        color: '#6b7280',
        marginBottom: 2,
    },
    table: {
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#2563eb',
        padding: 8,
        color: 'white',
    },
    tableHeaderCell: {
        fontSize: 9,
        fontWeight: 'bold',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        padding: 8,
    },
    tableRowAlt: {
        backgroundColor: '#f9fafb',
    },
    tableCell: {
        fontSize: 9,
        color: '#374151',
    },
    colNum: { width: '5%' },
    colDesc: { width: '40%' },
    colQty: { width: '10%', textAlign: 'center' },
    colPrice: { width: '15%', textAlign: 'right' },
    colTax: { width: '10%', textAlign: 'center' },
    colTotal: { width: '20%', textAlign: 'right' },
    totalsSection: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    totalsBox: {
        width: 250,
        backgroundColor: '#f9fafb',
        padding: 15,
        borderRadius: 4,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    totalLabel: {
        fontSize: 9,
        color: '#6b7280',
    },
    totalValue: {
        fontSize: 9,
        color: '#1f2937',
    },
    totalRowFinal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 2,
        borderTopColor: '#2563eb',
    },
    totalLabelFinal: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    totalValueFinal: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#2563eb',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        textAlign: 'center',
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    footerText: {
        fontSize: 8,
        color: '#9ca3af',
    },
    notes: {
        marginTop: 20,
        padding: 12,
        backgroundColor: '#fef3c7',
        borderRadius: 4,
    },
    notesTitle: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#92400e',
        marginBottom: 4,
    },
    notesText: {
        fontSize: 8,
        color: '#92400e',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-end',
        marginBottom: 10,
    },
    statusApproved: {
        backgroundColor: '#dcfce7',
    },
    statusDraft: {
        backgroundColor: '#f3f4f6',
    },
    statusPaid: {
        backgroundColor: '#dbeafe',
    },
    statusCancelled: {
        backgroundColor: '#fee2e2',
    },
    statusText: {
        fontSize: 8,
        fontWeight: 'bold',
    },
});

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(value);
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const getStatusStyle = (state: string) => {
    switch (state) {
        case 'APPROVED': return styles.statusApproved;
        case 'PAID': return styles.statusPaid;
        case 'CANCELLED': return styles.statusCancelled;
        default: return styles.statusDraft;
    }
};

const getStatusLabel = (state: string) => {
    switch (state) {
        case 'APPROVED': return 'APROBADA';
        case 'PAID': return 'PAGADA';
        case 'CANCELLED': return 'ANULADA';
        case 'SENT': return 'ENVIADA';
        default: return 'BORRADOR';
    }
};

interface InvoicePDFProps {
    invoice: InvoiceWithDetails;
    companyName?: string;
    companyNit?: string;
    companyAddress?: string;
    companyPhone?: string;
}

export function InvoicePDF({ 
    invoice, 
    companyName = 'DigiKawsay S.A.S.',
    companyNit = 'NIT: 900.123.456-7',
    companyAddress = 'Calle Principal #123',
    companyPhone = 'Tel: (601) 123-4567'
}: InvoicePDFProps) {
    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.companyInfo}>
                        <Text style={styles.companyName}>{companyName}</Text>
                        <Text style={styles.companyDetail}>{companyNit}</Text>
                        <Text style={styles.companyDetail}>{companyAddress}</Text>
                        <Text style={styles.companyDetail}>{companyPhone}</Text>
                    </View>
                    <View style={styles.invoiceInfo}>
                        <View style={[styles.statusBadge, getStatusStyle(invoice.state)]}>
                            <Text style={styles.statusText}>{getStatusLabel(invoice.state)}</Text>
                        </View>
                        <Text style={styles.invoiceTitle}>
                            {invoice.type === 'VENTA' ? 'FACTURA DE VENTA' : 'FACTURA DE COMPRA'}
                        </Text>
                        <Text style={styles.invoiceNumber}>
                            {invoice.prefix}-{String(invoice.number).padStart(5, '0')}
                        </Text>
                        <Text style={styles.invoiceDate}>Fecha: {formatDate(invoice.date)}</Text>
                        {invoice.due_date && (
                            <Text style={styles.invoiceDate}>Vencimiento: {formatDate(invoice.due_date)}</Text>
                        )}
                    </View>
                </View>

                {/* Client Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {invoice.type === 'VENTA' ? 'CLIENTE' : 'PROVEEDOR'}
                    </Text>
                    <View style={styles.clientInfo}>
                        <Text style={styles.clientName}>{invoice.third_party?.full_name || 'Sin asignar'}</Text>
                        {invoice.third_party && (
                            <>
                                <Text style={styles.clientDetail}>
                                    {invoice.third_party.document_type}: {invoice.third_party.document_number}
                                    {invoice.third_party.dv ? `-${invoice.third_party.dv}` : ''}
                                </Text>
                                {invoice.third_party.address && (
                                    <Text style={styles.clientDetail}>{invoice.third_party.address}</Text>
                                )}
                                {invoice.third_party.city && (
                                    <Text style={styles.clientDetail}>{invoice.third_party.city}</Text>
                                )}
                                {invoice.third_party.email && (
                                    <Text style={styles.clientDetail}>{invoice.third_party.email}</Text>
                                )}
                            </>
                        )}
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>DETALLE</Text>
                    <View style={styles.table}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, styles.colNum]}>#</Text>
                            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Descripción</Text>
                            <Text style={[styles.tableHeaderCell, styles.colQty]}>Cant.</Text>
                            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Precio Unit.</Text>
                            <Text style={[styles.tableHeaderCell, styles.colTax]}>IVA</Text>
                            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
                        </View>
                        
                        {/* Table Rows */}
                        {invoice.lines.map((line, index) => (
                            <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                                <Text style={[styles.tableCell, styles.colNum]}>{line.line_number}</Text>
                                <Text style={[styles.tableCell, styles.colDesc]}>{line.description}</Text>
                                <Text style={[styles.tableCell, styles.colQty]}>{line.quantity} {line.unit}</Text>
                                <Text style={[styles.tableCell, styles.colPrice]}>{formatCurrency(line.unit_price)}</Text>
                                <Text style={[styles.tableCell, styles.colTax]}>{line.tax_rate}%</Text>
                                <Text style={[styles.tableCell, styles.colTotal]}>{formatCurrency(line.total)}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Totals */}
                <View style={styles.totalsSection}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Subtotal</Text>
                            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
                        </View>
                        {invoice.discount > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Descuento</Text>
                                <Text style={styles.totalValue}>-{formatCurrency(invoice.discount)}</Text>
                            </View>
                        )}
                        {invoice.iva_5 > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>IVA 5%</Text>
                                <Text style={styles.totalValue}>{formatCurrency(invoice.iva_5)}</Text>
                            </View>
                        )}
                        {invoice.iva_19 > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>IVA 19%</Text>
                                <Text style={styles.totalValue}>{formatCurrency(invoice.iva_19)}</Text>
                            </View>
                        )}
                        {invoice.retention_source > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>(-) Rete Fuente</Text>
                                <Text style={styles.totalValue}>-{formatCurrency(invoice.retention_source)}</Text>
                            </View>
                        )}
                        {invoice.retention_iva > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>(-) Rete IVA</Text>
                                <Text style={styles.totalValue}>-{formatCurrency(invoice.retention_iva)}</Text>
                            </View>
                        )}
                        {invoice.retention_ica > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>(-) Rete ICA</Text>
                                <Text style={styles.totalValue}>-{formatCurrency(invoice.retention_ica)}</Text>
                            </View>
                        )}
                        <View style={styles.totalRowFinal}>
                            <Text style={styles.totalLabelFinal}>TOTAL</Text>
                            <Text style={styles.totalValueFinal}>{formatCurrency(invoice.total)}</Text>
                        </View>
                    </View>
                </View>

                {/* Notes */}
                {invoice.notes && (
                    <View style={styles.notes}>
                        <Text style={styles.notesTitle}>OBSERVACIONES:</Text>
                        <Text style={styles.notesText}>{invoice.notes}</Text>
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Documento generado por DigiKawsay - Sistema Contable
                    </Text>
                    <Text style={styles.footerText}>
                        Generado el {new Date().toLocaleDateString('es-CO')} a las {new Date().toLocaleTimeString('es-CO')}
                    </Text>
                </View>
            </Page>
        </Document>
    );
}

// Function to generate and download PDF
export async function downloadInvoicePDF(invoice: InvoiceWithDetails) {
    const blob = await pdf(<InvoicePDF invoice={invoice} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.prefix}-${String(invoice.number).padStart(5, '0')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
