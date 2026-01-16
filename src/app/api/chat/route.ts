import { NextRequest, NextResponse } from 'next/server';

const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY;
const BACKEND_URL = process.env.CHAT_BACKEND_URL || 'http://localhost:8001';

export async function POST(request: NextRequest) {
    try {
        const { message, history } = await request.json();

        if (!message) {
            return NextResponse.json(
                { error: 'El mensaje es requerido' },
                { status: 400 }
            );
        }

        // Call the Python backend for Claude integration
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                history: history || []
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Backend error:', errorData);
            throw new Error('Error del servicio de IA');
        }

        const data = await response.json();
        return NextResponse.json({ response: data.response });

    } catch (error: any) {
        console.error('Chat API error:', error);
        return NextResponse.json(
            { error: error.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
