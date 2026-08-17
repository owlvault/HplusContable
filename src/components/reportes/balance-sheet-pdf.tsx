'use client';

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
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
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        borderBottom: '1pt solid #ccc',
        paddingBottom: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    accountName: {
        flex: 1,
    },
    amount: {
        width: 100,
        textAlign: 'right',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderTop: '1pt solid #333',
        marginTop: 5,
        fontWeight: 'bold',
    },
    grandTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderTop: '2pt solid #000',
        marginTop: 10,
        fontWeight: 'bold',
        fontSize: 11,
    },
    balanceCheck: {
        marginTop: 20,
        padding: 10,
        backgroundColor: '#f0fdf4',
        borderRadius: 4,
    },
    balanceCheckError: {
        backgroundColor: '#fef2f2',
    },
    columns: {
        flexDirection: 'row',
        gap: 20,
    },
    column: {
        flex: 1,
    },
});

interface BalanceSheetItem {
    code: string;
    name: string;
    level: number;
    balance: number;
}

interface BalanceSheetPDFProps {
    assets: BalanceSheetItem[];
    liabilities: BalanceSheetItem[];
    equity: BalanceSheetItem[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    period: string;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(value);
};

const BalanceSheetDocument = ({ assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, period }: BalanceSheetPDFProps) => (
    <Document>
        <Page size="LETTER" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>ESTADO DE SITUACIÓN FINANCIERA</Text>
                <Text style={styles.subtitle}>DigiKawsay S.A.S.</Text>
                <Text style={styles.period}>{period}</Text>
            </View>

            <View style={styles.columns}>
                {/* Assets Column */}
                <View style={styles.column}>
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: '#1d4ed8' }]}>ACTIVO</Text>
                        {assets.map((item) => (
                            <View key={item.code} style={styles.row}>
                                <Text style={[styles.accountName, { paddingLeft: (item.level - 1) * 10 }]}>
                                    {item.code} - {item.name}
                                </Text>
                                <Text style={styles.amount}>{formatCurrency(item.balance)}</Text>
                            </View>
                        ))}
                        <View style={styles.totalRow}>
                            <Text>TOTAL ACTIVO</Text>
                            <Text style={styles.amount}>{formatCurrency(totalAssets)}</Text>
                        </View>
                    </View>
                </View>

                {/* Liabilities + Equity Column */}
                <View style={styles.column}>
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: '#b91c1c' }]}>PASIVO</Text>
                        {liabilities.map((item) => (
                            <View key={item.code} style={styles.row}>
                                <Text style={[styles.accountName, { paddingLeft: (item.level - 1) * 10 }]}>
                                    {item.code} - {item.name}
                                </Text>
                                <Text style={styles.amount}>{formatCurrency(item.balance)}</Text>
                            </View>
                        ))}
                        <View style={styles.totalRow}>
                            <Text>TOTAL PASIVO</Text>
                            <Text style={styles.amount}>{formatCurrency(totalLiabilities)}</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: '#15803d' }]}>PATRIMONIO</Text>
                        {equity.map((item) => (
                            <View key={item.code} style={styles.row}>
                                <Text style={[styles.accountName, { paddingLeft: (item.level - 1) * 10 }]}>
                                    {item.code} - {item.name}
                                </Text>
                                <Text style={styles.amount}>{formatCurrency(item.balance)}</Text>
                            </View>
                        ))}
                        <View style={styles.totalRow}>
                            <Text>TOTAL PATRIMONIO</Text>
                            <Text style={styles.amount}>{formatCurrency(totalEquity)}</Text>
                        </View>
                    </View>

                    <View style={styles.grandTotal}>
                        <Text>TOTAL PASIVO + PATRIMONIO</Text>
                        <Text style={styles.amount}>{formatCurrency(totalLiabilities + totalEquity)}</Text>
                    </View>
                </View>
            </View>

            <View style={
                Math.abs(totalAssets - (totalLiabilities + totalEquity)) >= 0.01 
                    ? [styles.balanceCheck, styles.balanceCheckError] 
                    : styles.balanceCheck
            }>
                <Text>
                    {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 
                        ? '✓ Ecuación contable balanceada (Activo = Pasivo + Patrimonio)'
                        : `⚠ Diferencia: ${formatCurrency(totalAssets - (totalLiabilities + totalEquity))}`
                    }
                </Text>
            </View>
        </Page>
    </Document>
);

export async function generateBalanceSheetPDF(data: BalanceSheetPDFProps): Promise<Blob> {
    const blob = await pdf(<BalanceSheetDocument {...data} />).toBlob();
    return blob;
}

export function downloadBalanceSheetPDF(data: BalanceSheetPDFProps, filename: string = 'balance-general.pdf') {
    generateBalanceSheetPDF(data).then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    });
}
