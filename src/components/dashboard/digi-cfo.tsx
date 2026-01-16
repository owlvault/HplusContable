'use client';

import { useState, useRef, useEffect } from 'react';
import { AnomaliesPanel } from './anomalies-panel';

type Message = {
    role: 'user' | 'assistant';
    content: string;
};

export function DigiCFO() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showAnomalies, setShowAnomalies] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: messages
                })
            });

            if (!response.ok) throw new Error('Error en la respuesta');

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: 'Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo.' 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const suggestedQuestions = [
        '¿Cómo está mi flujo de caja?',
        'Analiza mis gastos',
        '¿Qué impuestos debo pagar?'
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Anomalies Toggle */}
            <button
                onClick={() => setShowAnomalies(!showAnomalies)}
                className="btn"
                style={{ 
                    backgroundColor: showAnomalies ? 'hsl(var(--primary))' : 'transparent', 
                    color: showAnomalies ? 'white' : 'hsl(var(--text-main))',
                    border: '1px solid hsl(var(--border))',
                    fontSize: '0.875rem'
                }}
                data-testid="toggle-anomalies-button"
            >
                🔍 {showAnomalies ? 'Ocultar' : 'Ver'} Análisis de Anomalías
            </button>

            {showAnomalies && <AnomaliesPanel />}

            {/* Chat */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '400px', padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ 
                    padding: '1rem', 
                    borderBottom: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--text-inverse))'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>🤖</span>
                        <div>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>DigiCFO</h3>
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Tu asesor financiero IA</span>
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    {messages.length === 0 ? (
                        <div style={{ 
                            flex: 1, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '1rem',
                            color: 'hsl(var(--text-secondary))'
                        }}>
                            <span style={{ fontSize: '2rem' }}>💬</span>
                            <p style={{ fontSize: '0.875rem', textAlign: 'center' }}>
                                ¡Hola! Soy tu asesor financiero digital.<br/>
                                ¿En qué puedo ayudarte hoy?
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                                {suggestedQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setInput(q)}
                                        style={{
                                            padding: '0.5rem 0.75rem',
                                            fontSize: '0.75rem',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: 'var(--radius-md)',
                                            backgroundColor: 'transparent',
                                            cursor: 'pointer',
                                            color: 'hsl(var(--text-main))'
                                        }}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div
                                key={index}
                                style={{
                                    maxWidth: '85%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: 'var(--radius-lg)',
                                    fontSize: '0.875rem',
                                    lineHeight: 1.5,
                                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    backgroundColor: msg.role === 'user' 
                                        ? 'hsl(var(--primary))' 
                                        : 'hsl(var(--surface-hover))',
                                    color: msg.role === 'user' 
                                        ? 'hsl(var(--text-inverse))' 
                                        : 'hsl(var(--text-main))',
                                    whiteSpace: 'pre-wrap'
                                }}
                            >
                                {msg.content}
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div style={{
                            alignSelf: 'flex-start',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-lg)',
                            backgroundColor: 'hsl(var(--surface-hover))',
                            fontSize: '0.875rem'
                        }}>
                            <span style={{ animation: 'pulse 1.5s infinite' }}>Pensando...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSubmit} style={{ 
                    padding: '1rem', 
                    borderTop: '1px solid hsl(var(--border))',
                    display: 'flex',
                    gap: '0.5rem'
                }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Escribe tu pregunta..."
                        disabled={isLoading}
                        data-testid="chat-input"
                        style={{
                            flex: 1,
                            padding: '0.625rem 1rem',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                            outline: 'none'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="btn btn-primary"
                        data-testid="chat-send-button"
                        style={{ 
                            padding: '0.625rem 1rem',
                            opacity: isLoading || !input.trim() ? 0.5 : 1
                        }}
                    >
                        Enviar
                    </button>
                </form>
            </div>
        </div>
    );
}
