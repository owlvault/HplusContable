from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

from emergentintegrations.llm.chat import LlmChat, UserMessage

app = FastAPI(title="DigiCFO Chat API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://yatmqefliwhkoejmwdvt.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhdG1xZWZsaXdoa29lam13ZHZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIxMTI5NCwiZXhwIjoyMDgzNzg3Mjk0fQ.53T7CMoqI93Rz2VByTNTufALoYeLvoWGdyCnW5yq_Jc")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Models
class MessageHistory(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageHistory]] = []

class ChatResponse(BaseModel):
    response: str

def format_cop(amount):
    """Format number as Colombian Pesos"""
    return f"${amount:,.0f}".replace(",", ".")

async def get_financial_context():
    """Obtiene el contexto financiero real de Supabase"""
    context = {}
    
    try:
        # 1. Obtener totales por tipo de cuenta
        lines_response = supabase.table("journal_lines").select(
            "debit, credit, account_code, puc_accounts(name, type, nature)"
        ).execute()
        
        lines = lines_response.data if lines_response.data else []
        
        # Calcular totales por cuenta
        account_totals = {}
        for line in lines:
            code = line.get("account_code", "")
            if code not in account_totals:
                acc_info = line.get("puc_accounts", {}) or {}
                account_totals[code] = {
                    "name": acc_info.get("name", ""),
                    "type": acc_info.get("type", ""),
                    "nature": acc_info.get("nature", ""),
                    "debit": 0,
                    "credit": 0
                }
            account_totals[code]["debit"] += float(line.get("debit", 0) or 0)
            account_totals[code]["credit"] += float(line.get("credit", 0) or 0)
        
        # Calcular saldos
        for code, acc in account_totals.items():
            if acc["nature"] == "DEBITO":
                acc["balance"] = acc["debit"] - acc["credit"]
            else:
                acc["balance"] = acc["credit"] - acc["debit"]
        
        # Agrupar por tipo
        ingresos = sum(acc["balance"] for acc in account_totals.values() if acc["type"] == "INGRESO")
        gastos = sum(acc["balance"] for acc in account_totals.values() if acc["type"] == "GASTO")
        activos = sum(acc["balance"] for acc in account_totals.values() if acc["type"] == "ACTIVO")
        pasivos = sum(acc["balance"] for acc in account_totals.values() if acc["type"] == "PASIVO")
        
        context["ingresos_totales"] = ingresos
        context["gastos_totales"] = gastos
        context["utilidad_neta"] = ingresos - gastos
        context["activos_totales"] = activos
        context["pasivos_totales"] = pasivos
        
        # 2. Obtener cuentas con mayor movimiento
        top_cuentas = sorted(
            [(code, acc) for code, acc in account_totals.items() if acc["balance"] != 0],
            key=lambda x: abs(x[1]["balance"]),
            reverse=True
        )[:10]
        
        context["top_cuentas"] = [
            f"{code} - {acc['name']}: {format_cop(acc['balance'])} ({acc['type']})"
            for code, acc in top_cuentas
        ]
        
        # 3. Obtener terceros
        terceros_response = supabase.table("third_parties").select("*").execute()
        terceros = terceros_response.data if terceros_response.data else []
        
        clientes = [t for t in terceros if t.get("is_client")]
        proveedores = [t for t in terceros if t.get("is_provider")]
        empleados = [t for t in terceros if t.get("is_employee")]
        
        context["num_clientes"] = len(clientes)
        context["num_proveedores"] = len(proveedores)
        context["num_empleados"] = len(empleados)
        context["clientes"] = [c.get("full_name", "") for c in clientes[:5]]
        context["proveedores"] = [p.get("full_name", "") for p in proveedores[:5]]
        
        # 4. Obtener asientos recientes
        asientos_response = supabase.table("journal_entries").select(
            "date, description, state"
        ).order("date", desc=True).limit(10).execute()
        
        asientos = asientos_response.data if asientos_response.data else []
        context["num_asientos"] = len(lines) // 3  # Aproximado
        context["asientos_recientes"] = [
            f"{a.get('date', '')[:10]}: {a.get('description', '')}"
            for a in asientos[:5]
        ]
        
        # 5. Calcular métricas
        if pasivos > 0:
            context["ratio_liquidez"] = activos / pasivos
        else:
            context["ratio_liquidez"] = "N/A (sin pasivos)"
            
        if ingresos > 0:
            context["margen_utilidad"] = (ingresos - gastos) / ingresos * 100
        else:
            context["margen_utilidad"] = 0
            
        # 6. IVA
        iva_generado = sum(acc["balance"] for code, acc in account_totals.items() if "IVA GENERADO" in acc["name"].upper())
        iva_descontable = sum(acc["balance"] for code, acc in account_totals.items() if "IVA DESCONTABLE" in acc["name"].upper())
        context["iva_generado"] = iva_generado
        context["iva_descontable"] = iva_descontable
        context["iva_por_pagar"] = iva_generado - iva_descontable
        
        # 7. Retención en la fuente
        retefuente = sum(acc["balance"] for code, acc in account_totals.items() if "RETENCION" in acc["name"].upper())
        context["retefuente_retenida"] = retefuente
        
    except Exception as e:
        print(f"Error obteniendo contexto financiero: {e}")
        context["error"] = str(e)
    
    return context

def build_system_prompt(context):
    """Construye el prompt del sistema con datos reales"""
    
    return f"""Eres DigiCFO, un asesor financiero y contable experto especializado en la normativa colombiana.

DATOS FINANCIEROS ACTUALES DE LA EMPRESA (datos reales del sistema):

📊 RESUMEN FINANCIERO:
- Ingresos Totales: {format_cop(context.get('ingresos_totales', 0))}
- Gastos Totales: {format_cop(context.get('gastos_totales', 0))}
- Utilidad Neta: {format_cop(context.get('utilidad_neta', 0))}
- Margen de Utilidad: {context.get('margen_utilidad', 0):.1f}%

💰 BALANCE:
- Activos Totales: {format_cop(context.get('activos_totales', 0))}
- Pasivos Totales: {format_cop(context.get('pasivos_totales', 0))}
- Ratio de Liquidez: {context.get('ratio_liquidez', 'N/A')}

🧾 IMPUESTOS:
- IVA Generado (por pagar): {format_cop(context.get('iva_generado', 0))}
- IVA Descontable (a favor): {format_cop(context.get('iva_descontable', 0))}
- IVA Neto por Pagar: {format_cop(context.get('iva_por_pagar', 0))}
- Retención en la Fuente: {format_cop(context.get('retefuente_retenida', 0))}

👥 TERCEROS:
- Clientes: {context.get('num_clientes', 0)}
- Proveedores: {context.get('num_proveedores', 0)}
- Empleados: {context.get('num_empleados', 0)}
- Principales clientes: {', '.join(context.get('clientes', [])[:3])}
- Principales proveedores: {', '.join(context.get('proveedores', [])[:3])}

📋 CUENTAS CON MAYOR MOVIMIENTO:
{chr(10).join(context.get('top_cuentas', ['No hay datos'])[:7])}

📝 ÚLTIMOS MOVIMIENTOS:
{chr(10).join(context.get('asientos_recientes', ['No hay datos'])[:5])}

INSTRUCCIONES:
1. Usa SIEMPRE los datos reales mostrados arriba para responder
2. Sé específico con los números y porcentajes
3. Da recomendaciones basadas en los datos reales
4. Si te preguntan algo que no está en los datos, indícalo
5. Responde siempre en español
6. Sé conciso pero informativo
7. Si detectas problemas o alertas, menciónalos proactivamente
"""

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "DigiCFO Chat API"}

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")

        # Obtener contexto financiero real
        context = await get_financial_context()
        
        # Construir prompt con datos reales
        system_prompt = build_system_prompt(context)

        # Initialize chat with Claude
        chat = LlmChat(
            api_key=api_key,
            session_id="digicfo-session",
            system_message=system_prompt
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        # Build context from history
        history_context = ""
        if request.history:
            for msg in request.history[-4:]:  # Last 4 messages for context
                role = "Usuario" if msg.role == "user" else "DigiCFO"
                history_context += f"{role}: {msg.content}\n"
        
        # Create the message with context
        full_message = request.message
        if history_context:
            full_message = f"Conversación previa:\n{history_context}\n\nNueva pregunta: {request.message}"

        user_message = UserMessage(text=full_message)
        
        # Get response from Claude
        response = await chat.send_message(user_message)
        
        return ChatResponse(response=response)

    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
