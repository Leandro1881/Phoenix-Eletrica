import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  X,
  RotateCcw,
  CheckCircle2,
  Zap,
  ClipboardList,
  ChevronDown
} from 'lucide-react';
import {
  ChatMessage,
  QuoteItem,
  AgentStage,
  sendChatMessage,
  formatItem,
  formatList
} from '../services/aiService';

interface AiQuoteAssistantProps {
  onApplyMaterials: (materials: string) => void;
  onClose?: () => void;
  currentMaterials?: string;
}

// v2: conversa + lista estruturada + etapa (o formato antigo, só com mensagens, é descartado)
const STORAGE_KEY = 'phoenix_ai_chat_v2';

const WELCOME_TEXT =
  'Olá! Sou o assistente de orçamento da Phoenix Elétrica. Me diga quais materiais elétricos você precisa (com quantidade e medida, se souber) ou que obra vai fazer. Eu monto a lista e, no final, peço seu OK para colocar no orçamento.';

const welcomeMessage = (): ChatMessage => ({
  id: `welcome-${Date.now()}`,
  sender: 'assistant',
  text: WELCOME_TEXT,
  timestamp: new Date()
});

interface ChatState {
  messages: ChatMessage[];
  items: QuoteItem[];
  stage: AgentStage;
  // Itens já colocados no formulário (formatados): numa nova confirmação, só os novos vão para lá
  applied: string[];
}

const freshState = (): ChatState => ({ messages: [welcomeMessage()], items: [], stage: 'coletando', applied: [] });

function loadStoredState(): ChatState {
  if (typeof window === 'undefined') return freshState();
  try {
    localStorage.removeItem('phoenix_ai_chat_history');
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    // A conversa continua mesmo depois de a lista ir para o formulário
    if (Array.isArray(parsed?.messages) && parsed.messages.length > 0) {
      return {
        messages: parsed.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
        items: Array.isArray(parsed.items) ? parsed.items : [],
        stage: parsed.stage === 'aguardando_confirmacao' || parsed.stage === 'confirmado' ? parsed.stage : 'coletando',
        applied: Array.isArray(parsed.applied) ? parsed.applied.filter((a: unknown) => typeof a === 'string') : []
      };
    }
  } catch (e) {
    console.warn('Erro ao carregar histórico do chat:', e);
  }
  return freshState();
}

/**
 * Renderiza o texto formatando negritos (**texto**) e listas (* ou -)
 * sem deixar asteriscos expostos
 */
function renderFormattedMessage(text: string, isUser: boolean) {
  if (isUser) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Detecta marcadores de lista (* item, - item, • item, 1. item, * **item**)
        const bulletMatch = trimmed.match(/^([*\-•]|\d+\.)\s+(.*)$/);

        let contentToFormat = trimmed;
        let isBullet = false;

        if (bulletMatch) {
          isBullet = true;
          contentToFormat = bulletMatch[2];
        }

        // Divide o conteúdo procurando por **negrito**
        const parts = contentToFormat.split(/(\*\*.*?\*\*)/g);

        const formattedParts = parts.map((part, partIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2);
            return (
              <strong key={partIdx} className="font-extrabold text-slate-900">
                {inner}
              </strong>
            );
          }
          return <span key={partIdx}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5 my-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#004b9c] mt-1.5 shrink-0" />
              <div className="text-slate-800 leading-relaxed flex-1">
                {formattedParts}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="text-slate-800 leading-relaxed">
            {formattedParts}
          </p>
        );
      })}
    </div>
  );
}

export const AiQuoteAssistant: React.FC<AiQuoteAssistantProps> = ({
  onApplyMaterials,
  onClose
}) => {
  const [chat, setChat] = useState<ChatState>(loadStoredState);
  const { messages, items, stage, applied } = chat;
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [justApplied, setJustApplied] = useState(false);
  const [showList, setShowList] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Salva no localStorage sempre que a conversa ou a lista mudar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
    } catch (e) {
      console.warn('Erro ao salvar histórico do chat:', e);
    }
  }, [chat]);

  // Sugestões rápidas de início de atendimento
  const quickPrompts = [
    '🔌 Reforma elétrica residencial (fiação e tomadas)',
    '⚡ Montagem de quadro de distribuição com DR',
    '💡 Iluminação LED para galpão ou escritório',
    '🏗️ Infraestrutura com eletrodutos e perfilados'
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date()
    };

    const newHistory = [...messages, userMessage];
    setChat((prev) => ({ ...prev, messages: newHistory }));
    setInputValue('');
    setIsLoading(true);

    try {
      const result = await sendChatMessage(newHistory, items, stage);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: result.text,
        timestamp: new Date()
      };

      // Cliente deu OK: só os itens ainda não enviados vão para o formulário. A conversa continua aberta.
      const confirmed = result.stage === 'confirmado' && result.items.length > 0;
      const newItems = confirmed ? result.items.filter((it) => !applied.includes(formatItem(it))) : [];

      setChat((prev) => ({
        messages: [...prev.messages, assistantMessage],
        items: result.items,
        stage: result.stage,
        applied: newItems.length ? [...prev.applied, ...newItems.map(formatItem)] : prev.applied
      }));

      if (newItems.length) {
        onApplyMaterials(formatList(newItems));
        setJustApplied(true);
        setTimeout(() => setJustApplied(false), 3000);
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleResetChat = () => {
    setChat(freshState());
    setShowList(false);
  };

  return (
    <div className="flex flex-col h-[520px] max-h-[85vh] bg-white rounded-xl shadow-xl border border-slate-300 overflow-hidden animate-fadeIn">

      {/* 1. Header do Chatbot Phoenix Elétrica */}
      <div className="bg-gradient-to-r from-[#003882] via-[#004b9c] to-[#002f6c] p-3.5 sm:p-4 text-white flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-yellow-300">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#003882]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-extrabold text-sm sm:text-base leading-tight">
              <span>Assistente Técnico IA</span>
              <span className="bg-yellow-400 text-[#003882] text-[10px] font-black px-1.5 py-0.2 rounded uppercase">
                Phoenix
              </span>
            </div>
            <div className="text-[11px] text-blue-200 flex items-center gap-1">
              <span>Especialista em orçamentos elétricos</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleResetChat}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Reiniciar conversa"
            aria-label="Reiniciar conversa"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
              title="Fechar assistente"
              aria-label="Fechar assistente"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Área de Mensagens */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-slate-50/70" aria-live="polite">

        {/* Aviso de Guardrails / Balcão */}
        <div className="bg-blue-50/90 border border-blue-200/90 rounded-lg p-2.5 text-[11px] text-[#003882] flex items-center gap-2 shadow-2xs">
          <Zap className="w-4 h-4 text-[#d31010] shrink-0" />
          <span>
            <strong>Foco Técnico:</strong> Ajudamos você a listar os materiais. Preços e prazos são informados pelo balcão da Phoenix Elétrica.
          </span>
        </div>

        {/* Lista de Mensagens */}
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-md bg-[#004b9c] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className="max-w-[85%] sm:max-w-[78%]">
                <div
                  className={`p-3 rounded-xl text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-[#003882] text-white rounded-br-xs font-normal'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                  }`}
                >
                  {renderFormattedMessage(msg.text, isUser)}
                </div>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-md bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Indicador de Digitação / Pensamento da IA */}
        {isLoading && (
          <div className="flex gap-2.5 justify-start items-center">
            <div className="w-7 h-7 rounded-md bg-[#004b9c] text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-[#004b9c] rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-[#004b9c] rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-[#004b9c] rounded-full animate-bounce [animation-delay:0.4s]" />
              <span className="text-[11px] text-slate-500 font-medium ml-1">Analisando materiais...</span>
            </div>
          </div>
        )}

        {/* Sugestões rápidas para começar se houver poucas mensagens */}
        {messages.length <= 1 && !isLoading && (
          <div className="pt-2 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#004b9c]" />
              <span>Ou escolha um modelo rápido para montar sua lista:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="text-left p-2 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 hover:text-[#003882] transition-colors shadow-2xs cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Rodapé do Chat: lista anotada até agora e campo de texto */}
      <div className="p-3 bg-white border-t border-slate-200 space-y-2 shrink-0">

        {/* Itens anotados (só para conferência; a lista vai ao orçamento quando o cliente responde OK) */}
        {items.length > 0 && stage !== 'aguardando_confirmacao' && !justApplied && (
          <div className="text-[11px]">
            <button
              type="button"
              onClick={() => setShowList((v) => !v)}
              aria-expanded={showList}
              className="inline-flex items-center gap-1.5 text-[#003882] font-bold hover:underline cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>{items.length} {items.length === 1 ? 'item anotado' : 'itens anotados'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showList ? 'rotate-180' : ''}`} />
            </button>
            {showList && (
              <div className="mt-1.5 max-h-28 overflow-y-auto rounded-md bg-slate-50 border border-slate-200 p-2 text-slate-700 whitespace-pre-line">
                {formatList(items)}
              </div>
            )}
          </div>
        )}

        {/* Notificação de sucesso ao aplicar */}
        {justApplied ? (
          <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 font-bold flex items-center justify-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Lista colocada no seu orçamento!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSendMessage();
                }
              }}
              placeholder={stage === 'aguardando_confirmacao' ? 'Responda OK ou diga o que mudar...' : 'Ex: 3 rolos de cabo 2,5mm² azul e 4 disjuntores 20A'}
              aria-label="Mensagem para o assistente"
              maxLength={2000}
              disabled={isLoading}
              className="flex-1 bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 outline-none transition-all disabled:opacity-60"
            />

            <button
              type="button"
              disabled={!inputValue.trim() || isLoading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSendMessage();
              }}
              className="p-2.5 bg-[#004b9c] hover:bg-[#003882] text-white rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0"
              title="Enviar mensagem"
              aria-label="Enviar mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
