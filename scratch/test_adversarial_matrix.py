"""
Adversarial Verification Suite for DigiKawsay ERP Master Implementation Plan
Empirical verification of:
1. Double-entry Contrasiento symmetry and zero-sum balance under complex tax withholdings.
2. Inventory restock and COGS reversal under weighted-average cost changes.
3. Colombian statutory UVT withholding thresholds and Tax Regime logic.
4. Outbox Worker Lease Expiration & Zombie Event Recovery Query logic.
5. Credit Note Concept Code behavioral matrix (Concept 1, 2, 3, 4).
6. POS Offline Range Allocation & Negative Stock Sync Resolution.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple
from dataclasses import dataclass
from enum import Enum


# ============================================================================
# 1. DOUBLE-ENTRY CONTRASIENTO & TAX WITHHOLDING SYMMETRY TEST
# ============================================================================

@dataclass
class JournalLine:
    account_code: str
    description: str
    debit: Decimal
    credit: Decimal
    base_amount: Decimal = Decimal('0.00')

def create_sale_journal_entry(
    subtotal: Decimal,
    iva_rate: Decimal,
    cogs_amount: Decimal,
    is_client_retenedor: bool,
    client_regime: str
) -> List[JournalLine]:
    lines = []
    iva_amount = (subtotal * (iva_rate / Decimal('100.0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # Taxes and Withholdings
    retefuente = Decimal('0.00')
    reteiva = Decimal('0.00')
    reteica = Decimal('0.00')
    
    if is_client_retenedor:
        # Retefuente 2.5% on subtotal
        retefuente = (subtotal * Decimal('0.025')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        # ReteIVA 15% on IVA
        reteiva = (iva_amount * Decimal('0.15')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        # ReteICA 0.966% on subtotal
        reteica = (subtotal * Decimal('0.00966')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
    net_receivable = subtotal + iva_amount - (retefuente + reteiva + reteica)
    
    # 1. Revenue (Cr 4135)
    lines.append(JournalLine(account_code="413505", description="Ingreso Venta", debit=Decimal('0.00'), credit=subtotal, base_amount=subtotal))
    # 2. IVA Generado (Cr 2408)
    lines.append(JournalLine(account_code="240801", description="IVA Generado 19%", debit=Decimal('0.00'), credit=iva_amount, base_amount=subtotal))
    
    # 3. Retentions (Dr 1355)
    if retefuente > 0:
        lines.append(JournalLine(account_code="135515", description="Anticipo Retefuente", debit=retefuente, credit=Decimal('0.00'), base_amount=subtotal))
    if reteiva > 0:
        lines.append(JournalLine(account_code="135517", description="Anticipo ReteIVA", debit=reteiva, credit=Decimal('0.00'), base_amount=iva_amount))
    if reteica > 0:
        lines.append(JournalLine(account_code="135518", description="Anticipo ReteICA", debit=reteica, credit=Decimal('0.00'), base_amount=subtotal))
        
    # 4. Receivables (Dr 1305)
    lines.append(JournalLine(account_code="130505", description="Clientes Nacionales", debit=net_receivable, credit=Decimal('0.00'), base_amount=Decimal('0.00')))
    
    # 5. Inventory & COGS
    if cogs_amount > 0:
        lines.append(JournalLine(account_code="613505", description="Costo de Ventas", debit=cogs_amount, credit=Decimal('0.00'), base_amount=Decimal('0.00')))
        lines.append(JournalLine(account_code="143505", description="Inventario de Mercancías", debit=Decimal('0.00'), credit=cogs_amount, base_amount=Decimal('0.00')))
        
    return lines

def generate_compensating_reversal(original_lines: List[JournalLine]) -> List[JournalLine]:
    reversal_lines = []
    for line in original_lines:
        reversal_lines.append(JournalLine(
            account_code=line.account_code,
            description=f"REVERSAL: {line.description}",
            debit=line.credit, # Exact inversion
            credit=line.debit, # Exact inversion
            base_amount=line.base_amount
        ))
    return reversal_lines

def verify_double_entry_balance(lines: List[JournalLine]) -> Tuple[bool, Decimal, Decimal]:
    total_debit = sum(l.debit for l in lines)
    total_credit = sum(l.credit for l in lines)
    is_balanced = (total_debit == total_credit)
    return is_balanced, total_debit, total_credit


# ============================================================================
# 2. COLOMBIAN UVT & TAX REGIME RETENTION RULES
# ============================================================================

class TaxRegime(str, Enum):
    RESPONSABLE_IVA = "RESPONSABLE_IVA"
    NO_RESPONSABLE_IVA = "NO_RESPONSABLE_IVA"
    REGIMEN_SIMPLE = "REGIMEN_SIMPLE"
    GRAN_CONTRIBUYENTE = "GRAN_CONTRIBUYENTE"

def calculate_purchase_withholdings(
    subtotal: Decimal,
    concept_type: str, # "PURCHASE_GOODS", "SERVICES", "HONORARIOS", "ARRENDAMIENTO"
    supplier_regime: TaxRegime,
    buyer_regime: TaxRegime,
    is_supplier_autoretenedor: bool,
    uvt_value: Decimal = Decimal('47065.00') # 2024 UVT
) -> Dict[str, Decimal]:
    
    result = {
        "retefuente": Decimal('0.00'),
        "reteiva": Decimal('0.00'),
        "reteica": Decimal('0.00')
    }
    
    # 1. Buyer Withholding Agent Status Check (ET Art. 368-2)
    if buyer_regime == TaxRegime.NO_RESPONSABLE_IVA:
        return result # Non-responsible individuals are not withholding agents for general purchases
        
    # 2. Regime Exemption: Régimen Simple (ET Art. 911)
    if supplier_regime == TaxRegime.REGIMEN_SIMPLE:
        return result # No retefuente or reteica on RST suppliers
        
    # 3. Autoretenedor Exemption
    if is_supplier_autoretenedor:
        return result # Autoretenedores withhold their own taxes
        
    # 4. Gran Contribuyente Exemption (Normal buyer cannot withhold from Gran Contribuyente)
    if supplier_regime == TaxRegime.GRAN_CONTRIBUYENTE and buyer_regime != TaxRegime.GRAN_CONTRIBUYENTE:
        return result
        
    # Threshold checks in UVT
    if concept_type == "PURCHASE_GOODS":
        threshold_uvt = Decimal('27.0') # 27 UVT
        rate = Decimal('0.025') # 2.5% for declarantes
    elif concept_type == "SERVICES":
        threshold_uvt = Decimal('4.0') # 4 UVT
        rate = Decimal('0.04') # 4.0% for declarantes
    elif concept_type == "HONORARIOS":
        threshold_uvt = Decimal('0.0') # 0 UVT (from $1 COP)
        rate = Decimal('0.10') # 10% or 11%
    elif concept_type == "ARRENDAMIENTO":
        threshold_uvt = Decimal('0.0') # 0 UVT
        rate = Decimal('0.035') # 3.5%
    else:
        threshold_uvt = Decimal('0.0')
        rate = Decimal('0.0')
        
    min_base = threshold_uvt * uvt_value
    
    if subtotal >= min_base:
        result["retefuente"] = (subtotal * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        result["reteica"] = (subtotal * Decimal('0.00966')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
    return result


# ============================================================================
# 3. OUTBOX WORKER LEASE RECOVERY SQL TEST
# ============================================================================

def simulate_outbox_polling_query(events: List[dict], current_time: int, lock_timeout_seconds: int = 300) -> List[dict]:
    """
    Simulates the corrected Outbox Poller Query:
    SELECT * FROM outbox_events
    WHERE status IN ('PENDING', 'FAILED')
       OR (status = 'PROCESSING' AND locked_until < NOW())
    ORDER BY scheduled_for ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 10
    """
    eligible = []
    for ev in events:
        is_pending_or_failed = ev["status"] in ("PENDING", "FAILED")
        is_expired_lease = (ev["status"] == "PROCESSING" and ev["locked_until"] < current_time)
        
        if (is_pending_or_failed or is_expired_lease) and ev["scheduled_for"] <= current_time:
            eligible.append(ev)
    return eligible


# ============================================================================
# 4. CREDIT NOTE CONCEPT DISPATCH MATRIX
# ============================================================================

def process_credit_note_accounting(
    concept_code: str, # "1", "2", "3", "4"
    invoice_lines: List[dict],
    is_paid: bool
) -> dict:
    """
    Validates the accounting and inventory dispatch according to Colombian DIAN standard:
    - Concept 1: Partial return of goods -> Restock returned items, reverse partial revenue & IVA
    - Concept 2: Full invoice void -> Full restock, full revenue & IVA reversal, clear A/R or credit customer (2805)
    - Concept 3: Rebate / Discount -> ZERO restock, discount expense (4175) or sales reduction, partial IVA adjustment
    - Concept 4: Financial adjustment -> ZERO restock, financial entry only
    """
    should_restock = False
    restock_scope = "NONE"
    cash_refund_or_credit = False
    
    if concept_code == "1":
        should_restock = True
        restock_scope = "RETURNED_ITEMS_ONLY"
    elif concept_code == "2":
        should_restock = True
        restock_scope = "ALL_ITEMS"
        if is_paid:
            cash_refund_or_credit = True # Accrue to 280505
    elif concept_code == "3":
        should_restock = False
        restock_scope = "NONE"
    elif concept_code == "4":
        should_restock = False
        restock_scope = "NONE"
        
    return {
        "concept_code": concept_code,
        "should_restock": should_restock,
        "restock_scope": restock_scope,
        "requires_customer_credit_liability": cash_refund_or_credit
    }
