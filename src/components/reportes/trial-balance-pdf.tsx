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
    period: {
        fontSize: 10,
        color: '#888',
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
    colCode: {
        width: 60,
    },
    colName: {
        flex: 1,
    },
    colAmount: {
        width: 80,
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
});

interface TrialBalanceItem {
    code: string;
    name: string;
    level: number;
    debit: number;
    credit: number;
    balance: number;
    nature: string;
}

interface TrialBalancePDFProps {
    data: TrialBalanceItem[];
    period: string;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(value);
};

const TrialBalanceDocument = ({ data, period }: TrialBalancePDFProps) => {
    const totalDebit = data.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = data.reduce((sum, item) => sum + item.credit, 0);
    const totalBalance = data.reduce((sum, item) => sum + item.balance, 0);

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.title}>BALANCE DE COMPROBACIÓN</Text>
                    <Text style={styles.subtitle}>DigiKawsay S.A.S.</Text>
                    <Text style={styles.period}>{period}</Text>
                </View>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={styles.colCode}>Código</Text>
                    <Text style={styles.colName}>Cuenta</Text>
                    <Text style={styles.colAmount}>Débitos</Text>
                    <Text style={styles.colAmount}>Créditos</Text>
                    <Text style={styles.colAmount}>Saldo</Text>
                </View>

                {/* Table Rows */}
                {data.map((item) => (
                    <View key={item.code} style={styles.tableRow}>
                        <Text style={styles.colCode}>{item.code}</Text>
                        <Text style={[styles.colName, { paddingLeft: (item.level - 1) * 8 }]}>{item.name}</Text>
                        <Text style={styles.colAmount}>{formatCurrency(item.debit)}</Text>
                        <Text style={styles.colAmount}>{formatCurrency(item.credit)}</Text>
                        <Text style={[styles.colAmount, { color: item.balance >= 0 ? '#15803d' : '#b91c1c' }]}>
                            {formatCurrency(item.balance)}
                        </Text>
                    </View>
                ))}

                {/* Totals */}
                <View style={styles.totalRow}>
                    <Text style={styles.colCode}></Text>
                    <Text style={styles.colName}>TOTALES</Text>
                    <Text style={styles.colAmount}>{formatCurrency(totalDebit)}</Text>
                    <Text style={styles.colAmount}>{formatCurrency(totalCredit)}</Text>
                    <Text style={styles.colAmount}>{formatCurrency(totalBalance)}</Text>
                </View>

                {/* Balance Check */}
                <View style={{ marginTop: 20, padding: 10, backgroundColor: Math.abs(totalDebit - totalCredit) < 0.01 ? '#f0fdf4' : '#fef2f2' }}>
                    <Text>
                        {Math.abs(totalDebit - totalCredit) < 0.01 
                            ? '✓ Sumas iguales: Débitos = Créditos'
                            : `⚠ Diferencia: ${formatCurrency(totalDebit - totalCredit)}`
                        }
                    </Text>
                </View>
            </Page>
        </Document>
    );
};

export async function generateTrialBalancePDF(data: TrialBalanceItem[], period: string): Promise<Blob> {
    const blob = await pdf(<TrialBalanceDocument data={data} period={period} />).toBlob();
    return blob;
}

export function downloadTrialBalancePDF(data: TrialBalanceItem[], period: string, filename: string = 'balance-comprobacion.pdf') {
    generateTrialBalancePDF(data, period).then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    });
}
