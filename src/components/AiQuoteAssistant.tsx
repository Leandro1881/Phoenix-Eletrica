import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  X,
  RotateCcw,
  CheckCircle2,
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

const WELCOME_TEXT = 'Oi! 👋 Me conta o que você precisa que eu monto sua lista de materiais.';

// Atalhos para começar: rótulo curto no botão, frase completa enviada ao assistente
const QUICK_PROMPTS = [
  { label: 'Reforma residencial', text: 'Reforma elétrica residencial (fiação e tomadas)' },
  { label: 'Quadro com DR', text: 'Montagem de quadro de distribuição com DR' },
  { label: 'Iluminação LED', text: 'Iluminação LED para galpão ou escritório' },
  { label: 'Eletrodutos', text: 'Infraestrutura com eletrodutos e perfilados' }
];

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
        messages: parsed.messages.map((m: any) => ({
          ...m,
          text: String(m.id).startsWith('welcome-') ? WELCOME_TEXT : m.text,
          timestamp: new Date(m.timestamp)
        })),
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
              <strong key={partIdx} className="font-bold text-slate-900">
                {inner}
              </strong>
            );
          }
          return <span key={partIdx}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5 my-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0" />
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
    <div className="flex flex-col h-[540px] max-h-[80vh] bg-surface rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-fadeIn">

      {/* 1. Topo: quem atende */}
      <div className="bg-brand-navy px-4 py-3 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src="/icon-192.png" alt="" width={40} height={40} className="w-10 h-10 rounded-full bg-white p-1" />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-brand-navy" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-[15px]">Phoenix Elétrica</div>
            <div className="text-xs text-white/60">Online · responde na hora</div>
          </div>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            onClick={handleResetChat}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Começar de novo"
            aria-label="Começar de novo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Fechar"
              aria-label="Fechar conversa"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Conversa */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" aria-live="polite">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-brand-blue text-white rounded-2xl rounded-br-md'
                    : 'bg-white text-slate-800 rounded-2xl rounded-bl-md shadow-sm ring-1 ring-slate-900/5'
                }`}
              >
                {renderFormattedMessage(msg.text, isUser)}
              </div>
            </div>
          );
        })}

        {/* Digitando... */}
        {isLoading && (
          <div className="flex justify-start" aria-label="Digitando">
            <div className="bg-white rounded-2xl rounded-bl-md shadow-sm ring-1 ring-slate-900/5 px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.3s]" />
            </div>
          </div>
        )}

        {/* Atalhos para começar */}
        {messages.length <= 1 && !isLoading && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => handleSendMessage(prompt.text)}
                className="px-3 py-1.5 rounded-full bg-white ring-1 ring-brand-blue/30 text-brand-blue text-[13px] font-semibold hover:bg-brand-blue hover:text-white transition-colors cursor-pointer"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Lista anotada e campo de texto */}
      <div className="px-3 pt-2 pb-2.5 bg-white border-t border-slate-200/80 space-y-2 shrink-0">

        {/* Itens anotados (só para conferência; a lista vai ao orçamento quando o cliente responde OK) */}
        {items.length > 0 && stage !== 'aguardando_confirmacao' && !justApplied && (
          <div className="text-xs">
            <button
              type="button"
              onClick={() => setShowList((v) => !v)}
              aria-expanded={showList}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-blue-soft text-brand-blue font-semibold cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>{items.length} {items.length === 1 ? 'item na lista' : 'itens na lista'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showList ? 'rotate-180' : ''}`} />
            </button>
            {showList && (
              <div className="mt-1.5 max-h-28 overflow-y-auto rounded-lg bg-surface p-2 text-slate-700 whitespace-pre-line">
                {formatList(items)}
              </div>
            )}
          </div>
        )}

        {justApplied ? (
          <div className="py-2.5 bg-emerald-50 rounded-full text-sm text-emerald-800 font-semibold flex items-center justify-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Lista no seu orçamento!</span>
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
              placeholder={stage === 'aguardando_confirmacao' ? 'Responda OK ou diga o que mudar' : 'Ex: 3 rolos de cabo 2,5mm²'}
              aria-label="Mensagem"
              maxLength={2000}
              disabled={isLoading}
              className="flex-1 min-w-0 bg-surface focus:bg-white text-slate-900 placeholder-slate-400 text-base sm:text-sm px-4 py-2.5 rounded-full ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-blue/40 outline-none transition-all disabled:opacity-60"
            />

            <button
              type="button"
              disabled={!inputValue.trim() || isLoading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSendMessage();
              }}
              className="w-10 h-10 flex items-center justify-center bg-brand-blue hover:bg-brand-blue-dark text-white rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              title="Enviar"
              aria-label="Enviar mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        <p className="text-[11px] text-slate-400 text-center">Preços e prazos com nosso balcão</p>
      </div>

    </div>
  );
};
