import type { AgentStage, QuoteItem } from '../ai/quoteAgent';

export type { AgentStage, QuoteItem } from '../ai/quoteAgent';
export { formatItem, formatList } from '../ai/quoteAgent';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface ChatResult {
  text: string;
  items: QuoteItem[];
  stage: AgentStage;
}

/**
 * Envia a conversa, a lista atual e a etapa para o servidor.
 * As chaves de IA ficam só no servidor: o navegador nunca chama Gemini/OpenAI diretamente.
 */
export async function sendChatMessage(messages: ChatMessage[], items: QuoteItem[], stage: AgentStage): Promise<ChatResult> {
  const unchanged = (text: string): ChatResult => ({ text, items, stage });

  try {
    const res = await fetch('/api/chat-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.sender, text: m.text })),
        items,
        stage
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.text) {
      return {
        text: String(data.text).trim(),
        items: Array.isArray(data.items) ? data.items : items,
        stage: data.stage || 'coletando'
      };
    }
    // Limite de uso atingido: mostra o aviso do servidor
    if (data.message) return unchanged(data.message);
  } catch (serverErr) {
    console.warn('Rota /api/chat-assistant não respondeu:', serverErr);
  }

  return unchanged('Não consegui falar com o assistente agora. Tente de novo em instantes ou digite os materiais direto no formulário.');
}
