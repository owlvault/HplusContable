from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

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

# Models
class MessageHistory(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageHistory]] = []

class ChatResponse(BaseModel):
    response: str

# System prompt for the financial advisor
SYSTEM_PROMPT = """Eres DigiCFO, un asesor financiero y contable experto especializado en la normativa colombiana.

Tu rol es ayudar a empresas y contadores con:
- Análisis de flujo de caja y liquidez
- Interpretación del Plan Único de Cuentas (PUC) colombiano
- Obligaciones tributarias (IVA, Retención en la fuente, Renta)
- Consejos para optimización fiscal legal
- Análisis de estados financieros
- Buenas prácticas contables

Características de tus respuestas:
- Sé conciso pero completo
- Usa terminología contable colombiana cuando sea apropiado
- Si no tienes datos específicos del usuario, da consejos generales
- Recomienda siempre consultar con un contador certificado para decisiones importantes
- Responde siempre en español
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

        # Initialize chat with Claude
        chat = LlmChat(
            api_key=api_key,
            session_id="digicfo-session",
            system_message=SYSTEM_PROMPT
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        # Build context from history
        context = ""
        if request.history:
            for msg in request.history[-6:]:  # Last 6 messages for context
                role = "Usuario" if msg.role == "user" else "DigiCFO"
                context += f"{role}: {msg.content}\n"
        
        # Create the message with context
        full_message = request.message
        if context:
            full_message = f"Contexto de la conversación anterior:\n{context}\n\nNueva pregunta del usuario: {request.message}"

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
