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
        paddingVertical: 8,
        borderTop: '2pt solid #000',
        marginTop: 15,
        fontWeight: 'bold',
        fontSize: 12,
    },
    positive: {
        color: '#15803d',
    },
    negative: {
        color: '#b91c1c',
    },
});

interface IncomeStatementItem {
    code: string;
    name: string;
    level: number;
    amount: number;
}

interface IncomeStatementPDFProps {
    income: IncomeStatementItem[];
    expenses: IncomeStatementItem[];
    costs: IncomeStatementItem[];
    totalIncome: number;
    totalExpenses: number;
    totalCosts: number;
    netIncome: number;
    period: string;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(value);
};

const IncomeStatementDocument = ({ income, expenses, costs, totalIncome, totalExpenses, totalCosts, netIncome, period }: IncomeStatementPDFProps) => (
    <Document>
        <Page size="LETTER" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>ESTADO DE RESULTADOS</Text>
                <Text style={styles.subtitle}>HPlus Contable - CFO IA</Text>
                <Text style={styles.period}>{period}</Text>
            </View>

            {/* Income */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: '#15803d' }]}>INGRESOS OPERACIONALES</Text>
                {income.map((item) => (
                    <View key={item.code} style={styles.row}>
                        <Text style={[styles.accountName, { paddingLeft: (item.level - 1) * 10 }]}>
                            {item.code} - {item.name}
                        </Text>
                        <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                    </View>
                ))}
                <View style={styles.totalRow}>
                    <Text>TOTAL INGRESOS</Text>
                    <Text style={styles.amount}>{formatCurrency(totalIncome)}</Text>
                </View>
            </View>

            {/* Costs */}
            {costs.length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: '#b91c1c' }]}>COSTO DE VENTAS</Text>
                    {costs.map((item) => (
                        <View key={item.code} style={styles.row}>
                            <Text style={[styles.accountName, { paddingLeft: (item.level - 1) * 10 }]}>
                                {item.code} - {item.name}
                            </Text>
                            <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                        </View>
                    ))}
                    <View style={styles.totalRow}>
                        <Text>TOTAL COSTO DE VENTAS</Text>
                        <Text style={styles.amount}>{formatCurrency(totalCosts)}</Text>
                    </View>
                </View>
            )}

            {/* Gross Profit */}
            <View style={styles.totalRow}>
                <Text style={{ fontWeight: 'bold' }}>UTILIDAD BRUTA</Text>
                <Text style={[styles.amount, { fontWeight: 'bold' }]}>{formatCurrency(totalIncome - totalCosts)}</Text>
            </View>

            {/* Expenses */}
            <View style={[styles.section, { marginTop: 15 }]}>
                <Text style={[styles.sectionTitle, { color: '#b91c1c' }]}>GASTOS OPERACIONALES</Text>
                {expenses.length > 0 ? expenses.map((item) => (
                    <View key={item.code} style={styles.row}>
                        <Text style={[styles.accountName, { paddingLeft: (item.level - 1) * 10 }]}>
                            {item.code} - {item.name}
                        </Text>
                        <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                    </View>
                )) : (
                    <Text style={{ color: '#888', fontStyle: 'italic' }}>Sin gastos registrados</Text>
                )}
                <View style={styles.totalRow}>
                    <Text>TOTAL GASTOS</Text>
                    <Text style={styles.amount}>{formatCurrency(totalExpenses)}</Text>
                </View>
            </View>

            {/* Net Income */}
            <View style={styles.grandTotal}>
                <Text>UTILIDAD NETA DEL PERÍODO</Text>
                <Text style={[styles.amount, netIncome >= 0 ? styles.positive : styles.negative]}>
                    {formatCurrency(netIncome)}
                </Text>
            </View>
        </Page>
    </Document>
);

export async function generateIncomeStatementPDF(data: IncomeStatementPDFProps): Promise<Blob> {
    const blob = await pdf(<IncomeStatementDocument {...data} />).toBlob();
    return blob;
}

export function downloadIncomeStatementPDF(data: IncomeStatementPDFProps, filename: string = 'estado-resultados.pdf') {
    generateIncomeStatementPDF(data).then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    });
}
