import {
  calculateTrialBalance,
  RawJournalLineData,
} from '../src/lib/utils/trial-balance-calc';
import { computeClosingEntry, ResultAccountBalance } from '../src/lib/utils/closing-calc';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

console.log('=== EMPIRICAL VERIFICATION SUITE FOR TLE & CLOSING ENGINE ===\n');

// -------------------------------------------------------------------
// Test 1: Line 562 sorting condition verification
// -------------------------------------------------------------------
console.log('--- Test 1: Third-party sort order (line 562) ---');
const sortLines: RawJournalLineData[] = [
  {
    account_code: '13050501',
    entry_date: '2026-03-10',
    debit: 500000,
    credit: 0,
    third_party_id: 'tp-client-a',
    document_number: '001_A_DOC', // Document number that would sort before '0' lexicographically if not handled by third_party_id check
    third_party_name: 'CLIENT A',
  },
  {
    account_code: '13050501',
    entry_date: '2026-03-10',
    debit: 300000,
    credit: 0,
    third_party_id: null,
    document_number: '0',
    third_party_name: 'CUANTIAS MENORES',
  },
];

const sortReport = calculateTrialBalance(sortLines, {
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  includeThirdParty: true,
});

const leafItems = sortReport.items.filter((i) => i.code === '13050501');
assert(leafItems.length === 2, 'Should return 2 leaf items for 13050501 (1 summary + 1 detail)');
assert(
  leafItems[0].third_party_id === null,
  'First leaf item MUST be summary row (third_party_id === null)'
);
assert(
  leafItems[1].third_party_id === 'tp-client-a',
  'Second leaf item MUST be detail row (third_party_id === tp-client-a)'
);

// Directly test sort comparator behavior logic
const comp = (a: any, b: any) => {
  if (a.code !== b.code) return a.code.localeCompare(b.code);
  if (!a.third_party_id && b.third_party_id) return -1;
  if (a.third_party_id && !b.third_party_id) return 1;
  return (a.document_number || '').localeCompare(b.document_number || '');
};

const aDetail = { code: '13050501', third_party_id: 'tp-1', document_number: '0001' };
const bSummary = { code: '13050501', third_party_id: null, document_number: '0' };
assert(comp(aDetail, bSummary) === 1, 'Detail row vs Summary row comparison returns 1 (Detail goes after)');
assert(comp(bSummary, aDetail) === -1, 'Summary row vs Detail row comparison returns -1 (Summary goes before)');

// -------------------------------------------------------------------
// Test 2: Real accounts (1-3) multi-year carryover
// -------------------------------------------------------------------
console.log('\n--- Test 2: Real accounts multi-year carryover ---');
const realLines: RawJournalLineData[] = [
  { account_code: '11050501', entry_date: '2024-05-10', debit: 5000000, credit: 0 },
  { account_code: '11050501', entry_date: '2025-11-20', debit: 3000000, credit: 1000000 },
  { account_code: '11050501', entry_date: '2026-01-15', debit: 2000000, credit: 500000 },
  { account_code: '22050501', entry_date: '2024-01-01', debit: 0, credit: 4000000 },
  { account_code: '22050501', entry_date: '2025-06-01', debit: 1000000, credit: 0 },
];

const realReport = calculateTrialBalance(realLines, {
  startDate: '2026-02-01',
  endDate: '2026-02-28',
});

const cashItem = realReport.items.find((i) => i.code === '11050501');
assert(
  cashItem?.saldo_inicial === 8500000,
  `Cash saldo_inicial expected 8,500,000, got ${cashItem?.saldo_inicial}`
);

const supplierItem = realReport.items.find((i) => i.code === '22050501');
assert(
  supplierItem?.saldo_inicial === 3000000,
  `Supplier saldo_inicial expected 3,000,000, got ${supplierItem?.saldo_inicial}`
);

// -------------------------------------------------------------------
// Test 3: Nominal accounts (4-7) annual reset & profit to 360505
// -------------------------------------------------------------------
console.log('\n--- Test 3: Nominal accounts annual reset & net profit carryover to 360505 ---');
const profitLines: RawJournalLineData[] = [
  // 2025 Nominal movements: Revenue 50M, Expense 20M, Cost 15M -> Net Profit = +15M
  { account_code: '41350501', entry_date: '2025-06-15', debit: 0, credit: 50000000 },
  { account_code: '51050601', entry_date: '2025-07-20', debit: 20000000, credit: 0 },
  { account_code: '61350501', entry_date: '2025-08-10', debit: 15000000, credit: 0 },
];

const profitReport = calculateTrialBalance(profitLines, {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});

const rev2025 = profitReport.items.find((i) => i.code === '41350501');
assert(
  rev2025?.saldo_inicial === 0,
  `Revenue 41350501 saldo_inicial in 2026 expected 0, got ${rev2025?.saldo_inicial}`
);

const exp2025 = profitReport.items.find((i) => i.code === '51050601');
assert(
  exp2025?.saldo_inicial === 0,
  `Expense 51050601 saldo_inicial in 2026 expected 0, got ${exp2025?.saldo_inicial}`
);

const cost2025 = profitReport.items.find((i) => i.code === '61350501');
assert(
  cost2025?.saldo_inicial === 0,
  `Cost 61350501 saldo_inicial in 2026 expected 0, got ${cost2025?.saldo_inicial}`
);

const utilItem = profitReport.items.find((i) => i.code === '360505');
assert(
  utilItem?.saldo_inicial === 15000000,
  `Equity 360505 saldo_inicial expected 15,000,000, got ${utilItem?.saldo_inicial}`
);
assert(profitReport.totals.is_balanced === true, 'Trial balance is balanced (double-entry equality)');

// -------------------------------------------------------------------
// Test 4: Nominal accounts (4-7) annual reset & loss to 361005
// -------------------------------------------------------------------
console.log('\n--- Test 4: Nominal accounts annual reset & net loss carryover to 361005 ---');
const lossLines: RawJournalLineData[] = [
  // 2025 Nominal movements: Revenue 10M, Expense 18M -> Net Loss = -8M
  { account_code: '41350501', entry_date: '2025-06-15', debit: 0, credit: 10000000 },
  { account_code: '51050601', entry_date: '2025-07-20', debit: 18000000, credit: 0 },
];

const lossReport = calculateTrialBalance(lossLines, {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});

const lossRev = lossReport.items.find((i) => i.code === '41350501');
assert(lossRev?.saldo_inicial === 0, 'Revenue initial balance is 0');

const lossExp = lossReport.items.find((i) => i.code === '51050601');
assert(lossExp?.saldo_inicial === 0, 'Expense initial balance is 0');

const perdItem = lossReport.items.find((i) => i.code === '361005');
assert(
  perdItem?.saldo_inicial === 8000000,
  `Equity 361005 (Pérdida) saldo_inicial expected 8,000,000, got ${perdItem?.saldo_inicial}`
);
assert(lossReport.totals.is_balanced === true, 'Trial balance is balanced for loss scenario');

// -------------------------------------------------------------------
// Test 5: Nominal YTD carryover within same fiscal year
// -------------------------------------------------------------------
console.log('\n--- Test 5: Nominal YTD carryover within same fiscal year ---');
const ytdLines: RawJournalLineData[] = [
  { account_code: '41350501', entry_date: '2025-12-15', debit: 0, credit: 10000000 }, // Prior year -> reset!
  { account_code: '41350501', entry_date: '2026-01-15', debit: 0, credit: 5000000 },  // Jan 2026
  { account_code: '41350501', entry_date: '2026-02-15', debit: 0, credit: 3000000 },  // Feb 2026
  { account_code: '51050601', entry_date: '2026-01-30', debit: 2000000, credit: 0 },  // Jan 2026
];

const ytdReport = calculateTrialBalance(ytdLines, {
  startDate: '2026-03-01',
  endDate: '2026-03-31',
});

const ytdRev = ytdReport.items.find((i) => i.code === '41350501');
assert(
  ytdRev?.saldo_inicial === 8000000,
  `Revenue YTD 2026 saldo_inicial expected 8,000,000 (Jan+Feb 2026), got ${ytdRev?.saldo_inicial}`
);

const ytdExp = ytdReport.items.find((i) => i.code === '51050601');
assert(
  ytdExp?.saldo_inicial === 2000000,
  `Expense YTD 2026 saldo_inicial expected 2,000,000 (Jan 2026), got ${ytdExp?.saldo_inicial}`
);

const ytdUtil = ytdReport.items.find((i) => i.code === '360505');
assert(
  ytdUtil?.saldo_inicial === 10000000,
  `Prior year (2025) profit carryover into 360505 expected 10,000,000, got ${ytdUtil?.saldo_inicial}`
);

// -------------------------------------------------------------------
// Test 6: Closing utility (closing-calc.ts) test
// -------------------------------------------------------------------
console.log('\n--- Test 6: Closing entry utility (closing-calc.ts) ---');
const closingBalances: ResultAccountBalance[] = [
  { account_code: '4135', type: 'INGRESO', balance: -25000000 },
  { account_code: '5135', type: 'GASTO', balance: 10000000 },
  { account_code: '6135', type: 'COSTO_VENTAS', balance: 8000000 },
];
const closingRes = computeClosingEntry(closingBalances, {
  utilidadAccount: '360505',
  perdidaAccount: '361005',
});

assert(closingRes.totalIncome === 25000000, 'Total income is 25M');
assert(closingRes.totalExpense === 18000000, 'Total expense is 18M');
assert(closingRes.netResult === 7000000, 'Net result is +7M');
const totalClosingDebit = closingRes.lines.reduce((s, l) => s + l.debit, 0);
const totalClosingCredit = closingRes.lines.reduce((s, l) => s + l.credit, 0);
assert(
  totalClosingDebit === totalClosingCredit,
  `Closing journal entry is balanced (Debit=${totalClosingDebit}, Credit=${totalClosingCredit})`
);

console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);

if (failed > 0) {
  process.exit(1);
}
