export type AccountNature = 'DEBITO' | 'CREDITO';
export type AccountType =
  | 'ACTIVO'
  | 'PASIVO'
  | 'PATRIMONIO'
  | 'INGRESO'
  | 'GASTO'
  | 'COSTO_VENTAS'
  | 'COSTO_PRODUCCION'
  | 'CUENTAS_ORDEN';

export interface RawJournalLineData {
  account_code: string;
  entry_date: string; // YYYY-MM-DD or ISO timestamp
  debit: number;
  credit: number;
  third_party_id?: string | null;
  document_number?: string | null;
  third_party_name?: string | null;
  entry_type?: string | null; // e.g. 'CIERRE'
  entry_state?: string | null; // e.g. 'APROBADO'
}

export interface PucAccountInfo {
  code: string;
  name: string;
  nature?: AccountNature;
  type?: AccountType;
  level?: number;
  parent_code?: string | null;
}

export interface TrialBalanceOptions {
  startDate: string; // YYYY-MM-DD or ISO string
  endDate: string;   // YYYY-MM-DD or ISO string
  includeThirdParty?: boolean; // default false
  excludeClosingEntries?: boolean; // default true
  showZeroBalances?: boolean; // default false
  pucAccounts?: PucAccountInfo[];
}

export interface TrialBalanceItem {
  code: string;
  name: string;
  level: number; // 1 (Clase), 2 (Grupo), 3 (Cuenta), 4 (Subcuenta), 5 (Auxiliar)
  nature: AccountNature;
  type: AccountType;
  parent_code: string | null;

  // Optional third-party fields (for detail rows when includeThirdParty is true)
  third_party_id?: string | null;
  document_number?: string | null;
  third_party_name?: string | null;

  // Numeric balances (COP)
  saldo_inicial: number;
  debito: number;
  credito: number;
  saldo_final: number;

  // UI backward compatibility aliases
  debit: number;
  credit: number;
  balance: number;

  is_synthesized?: boolean;
}

export interface TrialBalanceReport {
  startDate: string;
  endDate: string;
  includeThirdParty: boolean;
  items: TrialBalanceItem[];
  totals: {
    saldo_inicial_debito: number;
    saldo_inicial_credito: number;
    total_debito: number;
    total_credito: number;
    saldo_final_debito: number;
    saldo_final_credito: number;
    is_balanced: boolean;
  };
}

export const STANDARD_PUC_NAMES: Record<string, string> = {
  '1': 'ACTIVO',
  '11': 'EFECTIVO Y EQUIVALENTES DE EFECTIVO',
  '1105': 'CAJA',
  '110505': 'Caja General',
  '1110': 'BANCOS',
  '111005': 'Bancos Nacionales',
  '13': 'DEUDORES',
  '1305': 'CLIENTES',
  '130505': 'Clientes Nacionales',
  '14': 'INVENTARIOS',
  '2': 'PASIVO',
  '22': 'PROVEEDORES',
  '2205': 'PROVEEDORES NACIONALES',
  '220505': 'Proveedores Nacionales',
  '23': 'CUENTAS POR PAGAR',
  '2335': 'COSTOS Y GASTOS POR PAGAR',
  '2365': 'RETENCION EN LA FUENTE',
  '24': 'IMPUESTOS, GRAVAMENES Y TASAS',
  '2408': 'IMPUESTO SOBRE LAS VENTAS POR PAGAR',
  '3': 'PATRIMONIO',
  '31': 'CAPITAL SOCIAL',
  '3105': 'CAPITAL SUSCRITO Y PAGADO',
  '310505': 'Capital Social',
  '36': 'RESULTADOS DEL EJERCICIO',
  '3605': 'UTILIDAD DEL EJERCICIO',
  '360505': 'Utilidad del ejercicio',
  '3610': 'PÉRDIDA DEL EJERCICIO',
  '361005': 'Pérdida del ejercicio',
  '37': 'RESULTADOS DE EJERCICIOS ANTERIORES',
  '3705': 'UTILIDADES ACUMULADAS',
  '370505': 'Utilidades acumuladas',
  '4': 'INGRESOS',
  '41': 'OPERACIONALES',
  '4135': 'COMERCIO AL POR MAYOR Y AL POR MENOR',
  '413505': 'Comercio al por mayor y al por menor',
  '42': 'NO OPERACIONALES',
  '4210': 'FINANCIEROS',
  '5': 'GASTOS',
  '51': 'OPERACIONALES DE ADMINISTRACION',
  '5105': 'GASTOS DE PERSONAL',
  '510506': 'Sueldos',
  '5120': 'ARRENDAMIENTOS',
  '5135': 'SERVICIOS',
  '52': 'OPERACIONALES DE VENTAS',
  '6': 'COSTOS DE VENTAS',
  '61': 'COSTO DE VENTAS Y DE PRESTACION DE SERVICIOS',
  '6135': 'COMERCIO AL POR MAYOR Y AL POR MENOR',
  '7': 'COSTOS DE PRODUCCION O DE OPERACION',
  '8': 'CUENTAS DE ORDEN DEUDORAS',
  '9': 'CUENTAS DE ORDEN ACREEDORAS',
};

const roundCOP = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export function inferAccountMeta(
  code: string,
  pucAccountsMap?: Map<string, PucAccountInfo>
): {
  code: string;
  name: string;
  nature: AccountNature;
  type: AccountType;
  level: number;
  parent_code: string | null;
  is_synthesized: boolean;
} {
  const existing = pucAccountsMap?.get(code);
  const firstChar = code.charAt(0);

  let type: AccountType = 'ACTIVO';
  let nature: AccountNature = 'DEBITO';

  switch (firstChar) {
    case '1':
      type = 'ACTIVO';
      nature = 'DEBITO';
      break;
    case '2':
      type = 'PASIVO';
      nature = 'CREDITO';
      break;
    case '3':
      type = 'PATRIMONIO';
      nature = 'CREDITO';
      break;
    case '4':
      type = 'INGRESO';
      nature = 'CREDITO';
      break;
    case '5':
      type = 'GASTO';
      nature = 'DEBITO';
      break;
    case '6':
      type = 'COSTO_VENTAS';
      nature = 'DEBITO';
      break;
    case '7':
      type = 'COSTO_PRODUCCION';
      nature = 'DEBITO';
      break;
    case '8':
      type = 'CUENTAS_ORDEN';
      nature = 'DEBITO';
      break;
    case '9':
      type = 'CUENTAS_ORDEN';
      nature = 'CREDITO';
      break;
  }

  const level =
    code.length <= 1 ? 1 : code.length <= 2 ? 2 : code.length <= 4 ? 3 : code.length <= 6 ? 4 : 5;

  let parent_code: string | null = null;
  if (code.length > 1) {
    if (code.length > 6) parent_code = code.substring(0, 6);
    else if (code.length > 4) parent_code = code.substring(0, 4);
    else if (code.length > 2) parent_code = code.substring(0, 2);
    else parent_code = code.substring(0, 1);
  }

  if (existing) {
    return {
      code,
      name: existing.name,
      nature: existing.nature || nature,
      type: existing.type || type,
      level: existing.level || level,
      parent_code: existing.parent_code !== undefined ? existing.parent_code : parent_code,
      is_synthesized: false,
    };
  }

  return {
    code,
    name: STANDARD_PUC_NAMES[code] || `CUENTA ${code}`,
    nature,
    type,
    level,
    parent_code,
    is_synthesized: true,
  };
}

export function getPrefixHierarchy(code: string): string[] {
  const prefixes: string[] = [];
  if (code.length >= 1) prefixes.push(code.substring(0, 1));
  if (code.length >= 2) prefixes.push(code.substring(0, 2));
  if (code.length >= 4) prefixes.push(code.substring(0, 4));
  if (code.length >= 6) prefixes.push(code.substring(0, 6));
  if (code.length > 6) prefixes.push(code);
  // Deduplicate in case code length is odd (e.g. 5)
  return Array.from(new Set(prefixes));
}

export function calculateTrialBalance(
  lines: RawJournalLineData[],
  options: TrialBalanceOptions
): TrialBalanceReport & TrialBalanceItem[] {
  const startDateStr = options.startDate.slice(0, 10);
  const endDateStr = options.endDate.slice(0, 10);
  const includeThirdParty = !!options.includeThirdParty;
  const excludeClosingEntries = options.excludeClosingEntries !== false; // default true
  const showZeroBalances = !!options.showZeroBalances;

  const startYear = parseInt(startDateStr.slice(0, 4), 10);
  const startOfYearStr = `${startYear}-01-01`;

  // Build PUC map for quick lookup
  const pucMap = new Map<string, PucAccountInfo>();
  if (options.pucAccounts) {
    for (const acc of options.pucAccounts) {
      pucMap.set(acc.code, acc);
    }
  }

  interface LeafAccumulator {
    account_code: string;
    third_party_id: string | null;
    document_number: string | null;
    third_party_name: string | null;
    priorDebit: number;
    priorCredit: number;
    periodDebit: number;
    periodCredit: number;
  }

  const leafMap = new Map<string, LeafAccumulator>();
  let priorFiscalYearsNetResult = 0; // Income - Expenses/Costs for prior years < startOfYear

  for (const line of lines) {
    if (excludeClosingEntries && line.entry_type === 'CIERRE') {
      continue;
    }
    if (line.entry_state === 'ANULADO') {
      continue;
    }

    const dateStr = line.entry_date.slice(0, 10);
    const isPrior = dateStr < startDateStr;
    const isPeriod = dateStr >= startDateStr && dateStr <= endDateStr;

    if (!isPrior && !isPeriod) {
      continue;
    }

    const accountCode = line.account_code;
    const firstChar = accountCode.charAt(0);
    const isReal = ['1', '2', '3'].includes(firstChar);
    const isNominal = ['4', '5', '6', '7'].includes(firstChar);

    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;

    if (isPrior) {
      if (isReal) {
        // Real accounts accumulate prior movements across all prior years
        const tpId = includeThirdParty ? (line.third_party_id || '0') : '';
        const key = includeThirdParty ? `${accountCode}__${tpId}` : accountCode;

        let item = leafMap.get(key);
        if (!item) {
          item = {
            account_code: accountCode,
            third_party_id: line.third_party_id || null,
            document_number: line.document_number || '0',
            third_party_name: line.third_party_name || 'CUANTIAS MENORES / GENERAL',
            priorDebit: 0,
            priorCredit: 0,
            periodDebit: 0,
            periodCredit: 0,
          };
          leafMap.set(key, item);
        }
        item.priorDebit += debit;
        item.priorCredit += credit;
      } else if (isNominal) {
        if (dateStr >= startOfYearStr) {
          // Nominal accounts accumulate prior movements ONLY within current fiscal year YTD
          const tpId = includeThirdParty ? (line.third_party_id || '0') : '';
          const key = includeThirdParty ? `${accountCode}__${tpId}` : accountCode;

          let item = leafMap.get(key);
          if (!item) {
            item = {
              account_code: accountCode,
              third_party_id: line.third_party_id || null,
              document_number: line.document_number || '0',
              third_party_name: line.third_party_name || 'CUANTIAS MENORES / GENERAL',
              priorDebit: 0,
              priorCredit: 0,
              periodDebit: 0,
              periodCredit: 0,
            };
            leafMap.set(key, item);
          }
          item.priorDebit += debit;
          item.priorCredit += credit;
        } else {
          // Prior fiscal years' nominal account lines carry forward into Equity
          if (firstChar === '4') {
            priorFiscalYearsNetResult += (credit - debit);
          } else {
            priorFiscalYearsNetResult -= (debit - credit);
          }
        }
      } else {
        // Order accounts (8, 9)
        const tpId = includeThirdParty ? (line.third_party_id || '0') : '';
        const key = includeThirdParty ? `${accountCode}__${tpId}` : accountCode;

        let item = leafMap.get(key);
        if (!item) {
          item = {
            account_code: accountCode,
            third_party_id: line.third_party_id || null,
            document_number: line.document_number || '0',
            third_party_name: line.third_party_name || 'CUANTIAS MENORES / GENERAL',
            priorDebit: 0,
            priorCredit: 0,
            periodDebit: 0,
            periodCredit: 0,
          };
          leafMap.set(key, item);
        }
        item.priorDebit += debit;
        item.priorCredit += credit;
      }
    }

    if (isPeriod) {
      const tpId = includeThirdParty ? (line.third_party_id || '0') : '';
      const key = includeThirdParty ? `${accountCode}__${tpId}` : accountCode;

      let item = leafMap.get(key);
      if (!item) {
        item = {
          account_code: accountCode,
          third_party_id: line.third_party_id || null,
          document_number: line.document_number || '0',
          third_party_name: line.third_party_name || 'CUANTIAS MENORES / GENERAL',
          priorDebit: 0,
          priorCredit: 0,
          periodDebit: 0,
          periodCredit: 0,
        };
        leafMap.set(key, item);
      }
      item.periodDebit += debit;
      item.periodCredit += credit;
    }
  }

  // Carry forward unclosed prior fiscal years' net profit/loss into Equity
  const netEquityAmount = roundCOP(priorFiscalYearsNetResult);
  if (netEquityAmount !== 0) {
    const equityCode = netEquityAmount > 0 ? '360505' : '361005';
    const tpId = includeThirdParty ? '0' : '';
    const key = includeThirdParty ? `${equityCode}__${tpId}` : equityCode;

    let item = leafMap.get(key);
    if (!item) {
      item = {
        account_code: equityCode,
        third_party_id: null,
        document_number: '0',
        third_party_name: 'CUANTIAS MENORES / GENERAL',
        priorDebit: 0,
        priorCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
      };
      leafMap.set(key, item);
    }

    if (netEquityAmount > 0) {
      item.priorCredit += netEquityAmount;
    } else {
      item.priorDebit += Math.abs(netEquityAmount);
    }
  }

  // Account level aggregations: map of code -> { saldo_inicial, debito, credito, saldo_final }
  interface AccTotals {
    saldo_inicial: number;
    debito: number;
    credito: number;
    saldo_final: number;
  }
  const accountAggMap = new Map<string, AccTotals>();

  // Intermediate leaf results for generating detail rows when includeThirdParty is true
  interface CalculatedLeaf {
    account_code: string;
    third_party_id: string | null;
    document_number: string | null;
    third_party_name: string | null;
    saldo_inicial: number;
    debito: number;
    credito: number;
    saldo_final: number;
  }
  const calculatedLeaves: CalculatedLeaf[] = [];

  for (const leaf of leafMap.values()) {
    const meta = inferAccountMeta(leaf.account_code, pucMap);
    let saldo_inicial = 0;
    const debito = roundCOP(leaf.periodDebit);
    const credito = roundCOP(leaf.periodCredit);
    let saldo_final = 0;

    if (meta.nature === 'DEBITO') {
      saldo_inicial = roundCOP(leaf.priorDebit - leaf.priorCredit);
      saldo_final = roundCOP(saldo_inicial + debito - credito);
    } else {
      saldo_inicial = roundCOP(leaf.priorCredit - leaf.priorDebit);
      saldo_final = roundCOP(saldo_inicial + credito - debito);
    }

    calculatedLeaves.push({
      account_code: leaf.account_code,
      third_party_id: leaf.third_party_id,
      document_number: leaf.document_number,
      third_party_name: leaf.third_party_name,
      saldo_inicial,
      debito,
      credito,
      saldo_final,
    });

    // Rollup to parent hierarchy
    const prefixes = getPrefixHierarchy(leaf.account_code);
    for (const prefix of prefixes) {
      let agg = accountAggMap.get(prefix);
      if (!agg) {
        agg = { saldo_inicial: 0, debito: 0, credito: 0, saldo_final: 0 };
        accountAggMap.set(prefix, agg);
      }
      agg.saldo_inicial = roundCOP(agg.saldo_inicial + saldo_inicial);
      agg.debito = roundCOP(agg.debito + debito);
      agg.credito = roundCOP(agg.credito + credito);
      agg.saldo_final = roundCOP(agg.saldo_final + saldo_final);
    }
  }

  const items: TrialBalanceItem[] = [];

  // Build account summary items
  for (const [code, agg] of accountAggMap.entries()) {
    const meta = inferAccountMeta(code, pucMap);
    items.push({
      code,
      name: meta.name,
      level: meta.level,
      nature: meta.nature,
      type: meta.type,
      parent_code: meta.parent_code,
      saldo_inicial: agg.saldo_inicial,
      debito: agg.debito,
      credito: agg.credito,
      saldo_final: agg.saldo_final,
      debit: agg.debito,
      credit: agg.credito,
      balance: agg.saldo_final,
      is_synthesized: meta.is_synthesized,
    });
  }

  // If includeThirdParty is true, append third party detail items
  if (includeThirdParty) {
    for (const leaf of calculatedLeaves) {
      const meta = inferAccountMeta(leaf.account_code, pucMap);
      items.push({
        code: leaf.account_code,
        name: meta.name,
        level: meta.level,
        nature: meta.nature,
        type: meta.type,
        parent_code: leaf.account_code,
        third_party_id: leaf.third_party_id || null,
        document_number: leaf.document_number || '0',
        third_party_name: leaf.third_party_name || 'CUANTIAS MENORES / GENERAL',
        saldo_inicial: leaf.saldo_inicial,
        debito: leaf.debito,
        credito: leaf.credito,
        saldo_final: leaf.saldo_final,
        debit: leaf.debito,
        credit: leaf.credito,
        balance: leaf.saldo_final,
        is_synthesized: false,
      });
    }
  }

  // Filter zero balances unless requested otherwise
  let filteredItems = items;
  if (!showZeroBalances) {
    filteredItems = items.filter(
      (item) =>
        item.saldo_inicial !== 0 ||
        item.debito !== 0 ||
        item.credito !== 0 ||
        item.saldo_final !== 0
    );
  }

  // Sort items: by code ascending, account summary row before third-party detail rows
  filteredItems.sort((a, b) => {
    if (a.code !== b.code) {
      return a.code.localeCompare(b.code);
    }
    // Summary row (third_party_id is null/undefined) comes first
    if (!a.third_party_id && b.third_party_id) return -1;
    if (a.third_party_id && !b.third_party_id) return 1;
    return (a.document_number || '').localeCompare(b.document_number || '');
  });

  // Calculate Level 1 global totals
  const level1Items = filteredItems.filter(
    (item) => item.level === 1 && !item.third_party_id
  );

  let saldo_inicial_debito = 0;
  let saldo_inicial_credito = 0;
  let total_debito = 0;
  let total_credito = 0;
  let saldo_final_debito = 0;
  let saldo_final_credito = 0;

  for (const item of level1Items) {
    total_debito = roundCOP(total_debito + item.debito);
    total_credito = roundCOP(total_credito + item.credito);

    if (item.nature === 'DEBITO') {
      if (item.saldo_inicial >= 0) {
        saldo_inicial_debito = roundCOP(saldo_inicial_debito + item.saldo_inicial);
      } else {
        saldo_inicial_credito = roundCOP(saldo_inicial_credito + Math.abs(item.saldo_inicial));
      }

      if (item.saldo_final >= 0) {
        saldo_final_debito = roundCOP(saldo_final_debito + item.saldo_final);
      } else {
        saldo_final_credito = roundCOP(saldo_final_credito + Math.abs(item.saldo_final));
      }
    } else {
      if (item.saldo_inicial >= 0) {
        saldo_inicial_credito = roundCOP(saldo_inicial_credito + item.saldo_inicial);
      } else {
        saldo_inicial_debito = roundCOP(saldo_inicial_debito + Math.abs(item.saldo_inicial));
      }

      if (item.saldo_final >= 0) {
        saldo_final_credito = roundCOP(saldo_final_credito + item.saldo_final);
      } else {
        saldo_final_debito = roundCOP(saldo_final_debito + Math.abs(item.saldo_final));
      }
    }
  }

  const is_balanced =
    Math.abs(total_debito - total_credito) <= 0.01 &&
    Math.abs(saldo_final_debito - saldo_final_credito) <= 0.01 &&
    Math.abs(saldo_inicial_debito - saldo_inicial_credito) <= 0.01;

  const totals = {
    saldo_inicial_debito,
    saldo_inicial_credito,
    total_debito,
    total_credito,
    saldo_final_debito,
    saldo_final_credito,
    is_balanced,
  };

  const reportArray = filteredItems as any;
  reportArray.startDate = startDateStr;
  reportArray.endDate = endDateStr;
  reportArray.includeThirdParty = includeThirdParty;
  reportArray.items = filteredItems;
  reportArray.totals = totals;

  return reportArray as TrialBalanceReport & TrialBalanceItem[];
}
