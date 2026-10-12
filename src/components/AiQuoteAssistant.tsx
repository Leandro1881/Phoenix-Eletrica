import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  User, 
  Sparkles, 
  X, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  Copy, 
  Check, 
  Zap,
  HelpCircle
} from 'lucide-react';
import { 
  ChatMessage, 
  sendChatMessage, 
  extractMaterialsList, 
  PHOENIX_SYSTEM_PROMPT 
} from '../services/aiService';

interface AiQuoteAssistantProps {
  onApplyMaterials: (materials: string) => void;
  onClose?: () => void;
  currentMaterials?: string;
}

const STORAGE_KEY = 'phoenix_ai_chat_history';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  sender: 'assistant',
  text: 'Olá! Sou o assistente técnico de vendas da Phoenix Elétrica, em São Paulo. Me diga que materiais você precisa ou que obra vai realizar, e eu monto a lista estruturada para o seu orçamento!',
  timestamp: new Date()
};

function loadStoredMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [INITIAL_MESSAGE];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [INITIAL_MESSAGE];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    }
  } catch (e) {
    console.warn('Erro ao carregar histórico do chat:', e);
  }
  return [INITIAL_MESSAGE];
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
  onClose,
  currentMaterials = ''
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredMessages);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [justApplied, setJustApplied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Salva no localStorage sempre que o histórico for atualizado
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Erro ao salvar histórico do chat:', e);
    }
  }, [messages]);

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
    setMessages(newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      const responseText = await sendChatMessage(newHistory);
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: new Date(),
        isFinalList: responseText.toLowerCase().includes('lista') && (
          responseText.toLowerCase().includes('pronta') || 
          responseText.toLowerCase().includes('estruturada') ||
          responseText.toLowerCase().includes('confirmada') ||
          responseText.toLowerCase().includes('finalizada') ||
          responseText.includes('•')
        )
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Detecta se a resposta confirma a lista e o envio/encaminhamento ao balcão
      const lowerResp = responseText.toLowerCase();
      const lowerUserPrompt = text.toLowerCase();
      
      const isConfirmedToBalcao = 
        lowerResp.includes('encaminhada ao balcão') ||
        lowerResp.includes('encaminhado ao balcão') ||
        lowerResp.includes('lista confirmada') ||
        lowerResp.includes('enviada ao balcão') ||
        lowerResp.includes('encaminhando ao balcão') ||
        (
          (lowerUserPrompt.includes('sim') || lowerUserPrompt.includes('pode') || lowerUserPrompt.includes('confirmo') || lowerUserPrompt.includes('encaminh') || lowerUserPrompt.includes('favor')) &&
          (lowerResp.includes('balcão') || lowerResp.includes('valores') || lowerResp.includes('equipe') || lowerResp.includes('condições'))
        );

      if (isConfirmedToBalcao) {
        // Extrai a relação de materiais da resposta ou do histórico
        let listToInsert = extractMaterialsList(responseText);
        if (!listToInsert || listToInsert.trim().length < 3) {
          const allAssistant = newHistory
            .filter((m) => m.sender === 'assistant')
            .map((m) => m.text)
            .join('\n');
          listToInsert = extractMaterialsList(allAssistant);
        }

        if (listToInsert && listToInsert.trim()) {
          onApplyMaterials(listToInsert.trim());
          setJustApplied(true);
          setTimeout(() => setJustApplied(false), 4000);
        }
      }
    } catch (err) {
      console.error('Erro na resposta da IA:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: 'Tivemos uma oscilação na conexão com o assistente. Por favor, tente novamente ou digite os materiais diretamente no formulário.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleApplyList = (textToExtract?: string) => {
    // Se passou texto específico (da mensagem clicada), usa ele; senão usa todas as mensagens da conversa
    const sourceText = textToExtract || messages
      .filter((m) => m.sender === 'assistant')
      .map((m) => m.text)
      .join('\n');

    let extracted = extractMaterialsList(sourceText);

    // Se a extração automática estiver vazia, consolida as mensagens do usuário
    if (!extracted || extracted.length < 5) {
      extracted = messages
        .filter((m) => m.sender === 'user')
        .map((m) => `• ${m.text}`)
        .join('\n');
    }

    if (extracted) {
      onApplyMaterials(extracted);
      setJustApplied(true);
      setTimeout(() => {
        setJustApplied(false);
        if (onClose) onClose();
      }, 1200);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    const resetMsg: ChatMessage = {
      id: `welcome-reset-${Date.now()}`,
      sender: 'assistant',
      text: 'Conversa reiniciada. Em que posso ajudar você a montar a lista de materiais elétricos da Phoenix Elétrica?',
      timestamp: new Date()
    };
    setMessages([resetMsg]);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([resetMsg]));
    } catch (_) {}
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
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
              title="Fechar assistente"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Área de Mensagens */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-slate-50/70">
        
        {/* Aviso de Guardrails / Balcão */}
        <div className="bg-blue-50/90 border border-blue-200/90 rounded-lg p-2.5 text-[11px] text-[#003882] flex items-center gap-2 shadow-2xs">
          <Zap className="w-4 h-4 text-[#d31010] shrink-0" />
          <span>
            <strong>Foco Técnico:</strong> Ajudamos você a dimensionar e listar materiais. Preços e prazos finais são calculados no balcão da Phoenix Elétrica.
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

              <div className={`max-w-[85%] sm:max-w-[78%] space-y-1.5`}>
                <div
                  className={`p-3 rounded-xl text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-[#003882] text-white rounded-br-xs font-normal'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                  }`}
                >
                  {renderFormattedMessage(msg.text, isUser)}
                </div>

                {/* Se a mensagem for do assistente e contiver uma lista real com marcadores, exibe botão de ação rápida */}
                {!isUser && msg.id !== 'welcome-msg' && !msg.id.startsWith('welcome-') && (msg.text.includes('•') || /^\s*[-*•]\s+/m.test(msg.text) || msg.isFinalList) && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleApplyList(msg.text)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Usar Esta Lista no Orçamento</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-200 transition-colors"
                      title="Copiar texto"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
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
        {messages.length <= 2 && !isLoading && (
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

      {/* 3. Rodapé do Chat com Campo de Texto e Botão de Aplicar */}
      <div className="p-3 bg-white border-t border-slate-200 space-y-2 shrink-0">
        
        {/* Notificação de sucesso ao aplicar */}
        {justApplied ? (
          <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 font-bold flex items-center justify-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Lista de materiais transferida para o seu orçamento com sucesso!</span>
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
              placeholder="Ex: Preciso de 3 rolos de cabo 2.5mm e 4 disjuntores..."
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
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Botão de Encerramento e Aplicação no Formulário Principal */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
          <span className="hidden sm:inline">
            Clique para enviar a lista para o campo de cotação
          </span>
          <button
            type="button"
            onClick={() => handleApplyList()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-md transition-colors shadow-2xs cursor-pointer ml-auto"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Inserir Lista no Orçamento</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
};
