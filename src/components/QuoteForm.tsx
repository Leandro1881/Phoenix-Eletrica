import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, MessageSquare, CheckCircle2, AlertCircle, ArrowRight, 
  ShieldCheck, Clock, ExternalLink, Paperclip, Upload, FileText, X,
  Sparkles, Bot
} from 'lucide-react';
import { motion } from 'motion/react';
import { trackWhatsAppClick } from '../utils/analytics';
import { AiQuoteAssistant } from './AiQuoteAssistant';

interface QuoteFormProps {
  initialMaterial?: string;
  onLeadSubmitted?: () => void;
  onOpenAiAssistant?: () => void;
}

// URL do endpoint oficial da AWS Lambda para captação de leads
const AWS_LAMBDA_URL = 'https://rl4eobl3ypivmz3vzx6npkj6e40ldowj.lambda-url.us-east-2.on.aws/';

// Carrega a chave dinamicamente via import.meta.env de acordo com o ambiente (Vite)
// Em dev (AI Studio / local): chave universal de teste 1x00000000000000000000AA
// Em prod: chave real 0x4AAAAAAFHknypuoYSkLpBF
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
const TURNSTILE_SITE_KEY = 
  import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || 
  (isDev ? '1x00000000000000000000AA' : '0x4AAAAAAFHknypuoYSkLpBF');

export const QuoteForm: React.FC<QuoteFormProps> = ({ 
  initialMaterial = '', 
  onLeadSubmitted,
  onOpenAiAssistant
}) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [materiais, setMateriais] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivoInfo, setArquivoInfo] = useState<{ nome: string; tamanho: string } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [aceitaMarketing, setAceitaMarketing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [successData, setSuccessData] = useState<{
    leadId: number;
    email: string;
    nome: string;
    redirectUrl?: string;
    fileUrl?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  // Aplica a lista gerada pelo Assistente IA diretamente ao campo materiais
  const handleApplyAiMaterials = (newMaterials: string) => {
    if (!newMaterials) return;
    setMateriais((prev) => {
      if (!prev || prev.trim() === '') return newMaterials;
      return `${prev}\n\n[Itens Adicionados pelo Assistente IA]:\n${newMaterials}`;
    });

    // Foca no campo de materiais e dá scroll suave para visualização
    setTimeout(() => {
      const el = document.getElementById('materiais');
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  // Preenche material se selecionado das categorias
  useEffect(() => {
    if (initialMaterial) {
      setMateriais((prev) => {
        if (!prev) return initialMaterial;
        if (prev.includes(initialMaterial)) return prev;
        return `${prev}, ${initialMaterial}`;
      });
    }
  }, [initialMaterial]);

  // Processa o arquivo selecionado ou arrastado e realiza o upload imediatamente
  const handleProcessFile = (file: File) => {
    if (!file) return;

    // Limite razoável de 15MB
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('O arquivo selecionado ultrapassa o limite de 15MB. Por favor, escolha um arquivo menor.');
      return;
    }

    setArquivo(file);
    const tamanhoStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    setArquivoInfo({
      nome: file.name,
      tamanho: tamanhoStr
    });
    setUploadedFileUrl(null);
    setErrorMsg(null);

    // Faz upload automático em segundo plano para obter o link público acessível no WhatsApp
    setIsUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileBase64: base64,
            fileSize: tamanhoStr,
            clientOrigin: currentOrigin
          })
        });
        const data = await res.json();
        if (data.url || data.safeFileName) {
          const rawUrl = data.url || `${currentOrigin}/uploads/${data.safeFileName}`;
          const publicUrl = rawUrl.replace('http://localhost:3000', currentOrigin);
          setUploadedFileUrl(publicUrl);
          console.log('Anexo carregado e link gerado:', publicUrl);
        }
      } catch (uploadErr) {
        console.warn('Upload prévio falhou, será retentado no envio:', uploadErr);
      } finally {
        setIsUploadingFile(false);
      }
    };
    reader.onerror = () => {
      setIsUploadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleRemoveFile = () => {
    setArquivo(null);
    setArquivoInfo(null);
    setUploadedFileUrl(null);
    setIsUploadingFile(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Função para abrir o WhatsApp em uma nova guia, preservando a tela da aplicação
  const triggerWhatsAppRedirect = (url: string) => {
    // 1. Tenta abrir em nova guia via window.open
    try {
      const newWin = window.open(url, '_blank', 'noopener,noreferrer');
      if (newWin && !newWin.closed && typeof newWin.closed !== 'undefined') {
        return;
      }
    } catch (e) {
      console.warn('Tentativa window.open:', e);
    }

    // 2. Fallback garantido: simula clique em tag <a> com target="_blank" para abrir em outra guia
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('Fallback link _blank:', err);
    }
  };

  // Efeito para garantir a inicialização segura e contínua do Cloudflare Turnstile
  useEffect(() => {
    if (typeof window === 'undefined' || successData) return;

    let isMounted = true;

    const renderTurnstile = () => {
      if (!isMounted || !turnstileContainerRef.current) return;
      if (!(window as any).turnstile) return;

      // Se o widget já estiver inserido dentro do container, evita duplicações
      if (turnstileContainerRef.current.childElementCount > 0) return;

      try {
        turnstileWidgetIdRef.current = (window as any).turnstile.render(turnstileContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          callback: (token: string) => {
            if (isMounted) {
              setTurnstileToken(token);
              setErrorMsg(null);
            }
          },
          'expired-callback': () => {
            if (isMounted) setTurnstileToken('');
          },
          'error-callback': () => {
            console.warn('Turnstile: validação pendente ou verificação em andamento.');
          }
        });
      } catch (err) {
        console.warn('Turnstile render:', err);
      }
    };

    renderTurnstile();
    const interval = setInterval(() => {
      if ((window as any).turnstile) {
        renderTurnstile();
        clearInterval(interval);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (turnstileWidgetIdRef.current && (window as any).turnstile?.remove) {
        try {
          (window as any).turnstile.remove(turnstileWidgetIdRef.current);
          turnstileWidgetIdRef.current = null;
        } catch (_) {}
      }
    };
  }, [successData]);

  // Máscara amigável de telefone brasileiro (DDD) 9XXXX-XXXX
  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);

    if (val.length > 10) {
      val = val.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (val.length > 6) {
      val = val.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    } else if (val.length > 2) {
      val = val.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    } else if (val.length > 0) {
      val = val.replace(/^(\d*)$/, '($1');
    }

    setTelefone(val);
  };

  // Submissão do formulário integrada com AWS Lambda
  const handleSubmit = async (e: React.FormEvent) => {
    // 1. Interceptar o Envio: previne o recarregamento padrão da página
    e.preventDefault();
    setErrorMsg(null);

    // 2. Capturar e higienizar os Dados
    const cleanNome = nome.trim();
    const cleanEmail = email.trim();
    const cleanTelefone = telefone.trim();
    const cleanCidade = cidade.trim();
    const cleanMateriais = materiais.trim();

    // Validação dos campos obrigatórios
    if (!cleanNome) {
      setErrorMsg('Por favor, informe seu nome completo.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Por favor, informe um endereço de e-mail válido para receber a confirmação.');
      return;
    }

    // Cliente pode digitar materiais OU anexar arquivo (PDF, Word, Excel, fotos)
    const hasMaterialsOrFile = cleanMateriais || arquivoInfo;
    if (!cleanTelefone || !cleanCidade || !hasMaterialsOrFile) {
      setErrorMsg('Por favor, preencha telefone, cidade e a relação de materiais (digitada ou em anexo).');
      return;
    }

    if (cleanTelefone.replace(/\D/g, '').length < 10) {
      setErrorMsg('Por favor, informe um número de telefone com DDD válido.');
      return;
    }

    // 3. Validação do token de segurança do Cloudflare Turnstile
    const turnstileInput = document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null;
    let effectiveToken = turnstileToken || turnstileInput?.value || '';

    // Se estiver em ambiente de desenvolvimento (AI Studio Preview / Local), não trava o formulário caso o iframe bloqueie
    if (!effectiveToken && isDev) {
      console.warn('[Turnstile Dev] Ambiente de desenvolvimento detectado: ignorando bloqueio de token para testes locais.');
      effectiveToken = 'DEV_LOCAL_BYPASS_TOKEN';
    } else if (!effectiveToken) {
      setErrorMsg('Por favor, conclua a verificação de segurança do Cloudflare Turnstile antes de solicitar a cotação.');
      return;
    }

    // UX/UI: Ativa estado de carregamento e desabilita botão para evitar cliques duplos
    setIsLoading(true);

    try {
      // 4. Formato do Payload (JSON): {"nome": nomeCliente, "email": emailCliente, "token": tokenCloudflare}
      const lambdaPayload = {
        nome: cleanNome,
        email: cleanEmail,
        token: effectiveToken
      };

      // 5. Requisição HTTP (Fetch) POST: tenta envio direto (quando não for token de bypass) e aciona proxy em caso de erro/CORS
      let lambdaSuccess = false;
      if (!effectiveToken.startsWith('DEV_')) {
        try {
          const lambdaResponse = await fetch(AWS_LAMBDA_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(lambdaPayload)
          });

          if (lambdaResponse.ok) {
            lambdaSuccess = true;
          } else {
            // Se a AWS Lambda respondeu diretamente com erro (ex: validação de segurança/bot)
            const errData = await lambdaResponse.json().catch(() => ({}));
            const errMsg = errData.mensagem || errData.message;
            if (errMsg) {
              throw new Error(errMsg);
            }
            console.warn(`AWS Lambda direto respondeu status ${lambdaResponse.status}, tentando rota proxy...`);
          }
        } catch (corsOrDirectErr: any) {
          // Se já for erro de validação emitido pela própria Lambda, propaga imediatamente
          if (corsOrDirectErr?.message && !corsOrDirectErr.message.includes('fetch') && !corsOrDirectErr.message.includes('Failed to fetch') && !corsOrDirectErr.message.includes('NetworkError')) {
            throw corsOrDirectErr;
          }
          console.warn('CORS ou rede bloqueou chamada direta na AWS Lambda. Acionando rota proxy /api/lambda-lead...', corsOrDirectErr);
        }
      }

      // Se a chamada direta não foi concluída (CORS no navegador), garante o envio através do proxy do backend
      if (!lambdaSuccess) {
        const proxyResponse = await fetch('/api/lambda-lead', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(lambdaPayload)
        });

        if (!proxyResponse.ok) {
          const errData = await proxyResponse.json().catch(() => ({}));
          const errMsg = errData.detail?.mensagem || errData.message || `Falha no envio para o servidor da AWS Lambda (${proxyResponse.status})`;
          throw new Error(errMsg);
        }
        lambdaSuccess = true;
      }

      // Se chegou aqui, a validação na AWS com o token Turnstile foi concluída com sucesso!

      // Prepara dados complementares para o WhatsApp e para o banco de dados interno
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      let finalFileUrl = uploadedFileUrl;
      let descricaoMateriais = cleanMateriais;
      if (arquivoInfo) {
        descricaoMateriais = cleanMateriais 
          ? `${cleanMateriais} (Anexo: ${arquivoInfo.nome})`
          : `[Arquivo em Anexo: ${arquivoInfo.nome}]`;
      }

      const whatsappNumber = '5511983239782';
      let textMessage = `Olá! Meu nome é *${cleanNome}*, sou de *${cleanCidade}* e acabei de solicitar uma cotação no site da Phoenix Elétrica:\n\n` +
        `*E-mail:* ${cleanEmail}\n` +
        `*Telefone:* ${cleanTelefone}\n\n` +
        `*Relação de Materiais:*\n${descricaoMateriais}`;

      if (finalFileUrl) {
        textMessage += `\n\n*Arquivo em Anexo:* ${arquivoInfo?.nome} (${arquivoInfo?.tamanho})\n*Link para Visualizar / Baixar:* ${finalFileUrl}`;
      } else if (arquivoInfo) {
        textMessage += `\n\n*Arquivo em Anexo:* ${arquivoInfo.nome} (${arquivoInfo.tamanho})`;
      }

      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(textMessage)}`;

      // Sincronização em background no banco SQLite local para manter histórico no painel administrativo
      fetch('/api/orcamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: cleanNome,
          email: cleanEmail,
          telefone: cleanTelefone,
          cidade: cleanCidade,
          materiais: descricaoMateriais,
          arquivo_nome: arquivoInfo?.nome || '',
          arquivo_tamanho: arquivoInfo?.tamanho || '',
          arquivo_url: finalFileUrl || '',
          aceita_marketing: aceitaMarketing
        }),
        keepalive: true
      }).catch((e) => console.warn('Sync SQLite local:', e));

      if (onLeadSubmitted) {
        onLeadSubmitted();
      }

      trackWhatsAppClick('Formulário de Cotação', 'Cotação Enviada e Redirecionada para WhatsApp');

      // Redireciona imediatamente o cliente para o WhatsApp do vendedor com as informações do formulário
      triggerWhatsAppRedirect(whatsappUrl);

      // Tratamento de Sucesso: Oculta campos do formulário e exibe mensagem amigável
      setSuccessData({
        leadId: Date.now(),
        email: cleanEmail,
        nome: cleanNome,
        redirectUrl: whatsappUrl,
        fileUrl: finalFileUrl || undefined
      });

    } catch (err: any) {
      console.error('Erro na integração com AWS Lambda:', err);
      try {
        if (typeof window !== 'undefined' && (window as any).turnstile?.reset) {
          (window as any).turnstile.reset(turnstileWidgetIdRef.current || undefined);
        }
      } catch (_) {}
      setTurnstileToken('');
      // Tratamento de Erro: exibe alerta amigável ou mensagem da validação
      setErrorMsg(err?.message || 'Não foi possível enviar sua solicitação no momento. Por favor, tente novamente ou entre em contato diretamente pelo nosso WhatsApp.');
    } finally {
      // Restaura o estado original do botão
      setIsLoading(false);
    }
  };

  return (
    <motion.section 
      id="orcamento" 
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="py-8 sm:py-16 bg-[#f4f6f9] border-b border-slate-200 relative scroll-mt-20"
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Header da Seção */}
        <div className="text-center space-y-1.5 sm:space-y-2 mb-6 sm:mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-[#d31010]">
            Atendimento Rápido para Compras & Obras
          </span>
          <h2 className="text-xl sm:text-3xl font-extrabold text-[#003882] tracking-tight">
            Solicite sua Cotação de Materiais Elétricos
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-xl mx-auto">
            Envie sua relação digitada ou anexe seu orçamento (PDF, Word, Excel). Seus dados são salvos em nosso banco e você é conectado direto ao vendedor técnico.
          </p>
        </div>

        {/* Card do Formulário (Estilo Comercial Limpo) */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 sm:p-8 shadow-sm relative overflow-hidden">
          
          {/* Faixa Superior Azul e Vermelha da Logo */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#003882] via-[#004b9c] to-[#d31010]" />

          {/* Estado de Sucesso: Oculta campos do formulário e exibe mensagem amigável */}
          {successData ? (
            <div className="py-6 sm:py-10 text-center space-y-5 animate-fadeIn">
              
              {/* Ícone de Sucesso Animado */}
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-[#003882] text-white flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Cotação Enviada com Sucesso!</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
                  Obrigado! Em breve, retornaremos com sua cotação
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Recebemos a solicitação de <strong>{successData.nome}</strong>. Seus dados foram encaminhados com sucesso e você está sendo redirecionado para o WhatsApp do nosso vendedor técnico.
                </p>

                {arquivoInfo && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium mt-1">
                    <Paperclip className="w-3.5 h-3.5 text-[#004b9c]" />
                    <span>Arquivo anexado: <strong>{arquivoInfo.nome}</strong> ({arquivoInfo.tamanho})</span>
                  </div>
                )}
              </div>

              {/* Botões de Ação Pós-Envio */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                {successData.redirectUrl && (
                  <a
                    href={successData.redirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackWhatsAppClick('Formulário de Cotação', 'Abrir WhatsApp Manual Pós-Envio')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-sm px-6 py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 fill-current" />
                    <span>Falar com Vendedor no WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSuccessData(null);
                    setNome('');
                    setEmail('');
                    setTelefone('');
                    setCidade('');
                    setMateriais('');
                    setArquivo(null);
                    setArquivoInfo(null);
                    setAceitaMarketing(false);
                    setErrorMsg(null);
                  }}
                  className="w-full sm:w-auto text-xs text-slate-600 hover:text-slate-900 px-5 py-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  Enviar Nova Cotação
                </button>
              </div>
            </div>
          ) : (
            /* Formulário Normal */
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Mensagem de Erro */}
              {errorMsg && (
                <div className="p-3.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* Campo: Nome Completo */}
                <div>
                  <label htmlFor="nome" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Nome Completo <span className="text-[#d31010]">*</span>
                  </label>
                  <input
                    type="text"
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    placeholder="Ex: Carlos Roberto Silva"
                    className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 rounded-md px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-xs sm:text-sm transition-all outline-none"
                  />
                </div>

                {/* Campo: E-mail */}
                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    E-mail <span className="text-[#d31010]">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 rounded-md px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-xs sm:text-sm transition-all outline-none"
                  />
                </div>

                {/* Campo: Telefone */}
                <div>
                  <label htmlFor="telefone" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Telefone / WhatsApp <span className="text-[#d31010]">*</span>
                  </label>
                  <input
                    type="tel"
                    id="telefone"
                    value={telefone}
                    onChange={handleTelefoneChange}
                    required
                    placeholder="(11) 98323-9782"
                    maxLength={15}
                    className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 rounded-md px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-xs sm:text-sm transition-all outline-none"
                  />
                </div>

                {/* Campo: Cidade */}
                <div>
                  <label htmlFor="cidade" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Cidade e Estado <span className="text-[#d31010]">*</span>
                  </label>
                  <input
                    type="text"
                    id="cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    required
                    placeholder="Ex: São Paulo - SP"
                    className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 rounded-md px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-xs sm:text-sm transition-all outline-none"
                  />
                </div>

              </div>

              {/* Campo de Anexo de Arquivo (PDF, Word, Excel, etc.) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-[#004b9c]" />
                    <span>Anexar Orçamento ou Lista Pronta</span>
                    <span className="text-[11px] text-slate-500 font-normal lowercase">(PDF, Word, Excel, Imagem)</span>
                  </label>
                  {arquivoInfo && (
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Arquivo anexado
                    </span>
                  )}
                </div>

                {!arquivoInfo ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) handleProcessFile(droppedFile);
                    }}
                    className={`border-2 border-dashed rounded-lg p-5 sm:p-6 text-center cursor-pointer transition-all duration-300 group ${
                      isDragging
                        ? 'border-[#003882] bg-blue-100/80 scale-[1.01] shadow-md ring-4 ring-blue-200/60'
                        : 'border-slate-300 hover:border-[#004b9c] bg-slate-50/80 hover:bg-blue-50/40 hover:shadow-xs'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="arquivo-anexo"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.odt,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                    />
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-slate-600">
                      <div className={`w-11 h-11 rounded-full shadow-xs border flex items-center justify-center transition-all duration-300 shrink-0 ${
                        isDragging
                          ? 'bg-[#003882] text-white scale-110 animate-bounce border-[#003882]'
                          : 'bg-white text-[#004b9c] border-slate-200 group-hover:scale-110 group-hover:bg-blue-50'
                      }`}>
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-center sm:text-left">
                        <div className={`text-xs sm:text-sm font-bold transition-colors ${
                          isDragging ? 'text-[#003882]' : 'text-slate-800'
                        }`}>
                          {isDragging 
                            ? 'Solte seu arquivo ou orçamento aqui!' 
                            : 'Clique para anexar seu arquivo ou arraste para cá'
                          }
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Aceita <strong>PDF, Word (.doc, .docx), Excel (.xlsx, .csv)</strong> ou fotos de listas até 15MB
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-[#004b9c] text-white flex items-center justify-center shrink-0 shadow-xs">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate" title={arquivoInfo.nome}>
                          {arquivoInfo.nome}
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5">
                          <span>{arquivoInfo.tamanho}</span>
                          <span>•</span>
                          {isUploadingFile ? (
                            <span className="text-amber-700 font-semibold animate-pulse">
                              Gerando link para WhatsApp...
                            </span>
                          ) : uploadedFileUrl ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span>✓ Link gerado para WhatsApp</span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold">Anexo pronto para envio</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded transition-colors cursor-pointer shrink-0 ml-2"
                      title="Remover anexo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Assistente Técnico com IA da Phoenix Elétrica */}
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-blue-50 via-indigo-50/60 to-blue-50 border border-blue-200/90 rounded-lg p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#004b9c] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0">
                      <Sparkles className="w-4 h-4 text-yellow-300" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-[#003882] flex items-center gap-1.5 flex-wrap">
                        <span>Precisa de ajuda para montar sua lista de materiais?</span>
                        <span className="bg-gradient-to-r from-blue-600 to-[#003882] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-2xs">
                          IA Oficial
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Converse com nosso assistente técnico especializado para dimensionar fiação, disjuntores e itens complementares.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenAiAssistant) {
                        onOpenAiAssistant();
                      } else {
                        setShowAiAssistant((prev) => !prev);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 bg-[#003882] hover:bg-[#002f6c] text-white text-xs font-bold px-3.5 py-2 rounded-md shadow-2xs hover:shadow-xs transition-all shrink-0 cursor-pointer"
                  >
                    <Bot className="w-4 h-4 text-yellow-300" />
                    <span>Montar Lista com IA ✨</span>
                  </button>
                </div>

                {/* Exibição do Chatbot Assistente de Vendas Inline (se não usar modal global) */}
                {!onOpenAiAssistant && showAiAssistant && (
                  <div className="animate-fadeIn">
                    <AiQuoteAssistant
                      onApplyMaterials={handleApplyAiMaterials}
                      onClose={() => setShowAiAssistant(false)}
                      currentMaterials={materiais}
                    />
                  </div>
                )}
              </div>

              {/* Campo: Materiais / Lista de Compras */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="materiais" className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <span>Produto(s) / Lista de Materiais</span>
                    {arquivoInfo ? (
                      <span className="text-[11px] text-emerald-700 font-normal lowercase">(opcional se já anexou o arquivo acima)</span>
                    ) : (
                      <span className="text-[#d31010]">*</span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenAiAssistant) {
                          onOpenAiAssistant();
                        } else {
                          setShowAiAssistant(true);
                        }
                      }}
                      className="text-[11px] text-[#004b9c] hover:text-[#003882] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span>Montar com IA</span>
                    </button>
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      {arquivoInfo ? 'Adicione observações se desejar' : 'Cole sua relação ou descreva os itens'}
                    </span>
                  </div>
                </div>
                
                <textarea
                  id="materiais"
                  value={materiais}
                  onChange={(e) => setMateriais(e.target.value)}
                  rows={arquivoInfo ? 2 : 4}
                  required={!arquivoInfo}
                  placeholder={
                    arquivoInfo 
                      ? "Opcional: Caso queira, informe aqui marcas de preferência, prazos de entrega ou observações complementares..." 
                      : "Ex: 3 rolos de cabo flexível 2.5mm² (vermelho, azul e verde), 4 disjuntores monopolares 20A Curva C, 50m eletroduto corrugado 25mm..."
                  }
                  className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 rounded-md px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-xs sm:text-sm transition-all outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Aviso de Confirmação & Segurança */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-md flex items-center justify-between gap-3 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#004b9c] shrink-0" />
                  <span>Seus dados são salvos em nosso banco e você é direcionado direto ao WhatsApp.</span>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-[#004b9c]" />
                  <span>Retorno médio: 15 min</span>
                </div>
              </div>

              {/* Bloco de Consentimento LGPD (Opt-in de Marketing) */}
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-start gap-3 transition-colors hover:bg-slate-100/70">
                <input
                  type="checkbox"
                  id="aceita_marketing"
                  name="aceita_marketing"
                  checked={aceitaMarketing}
                  onChange={(e) => setAceitaMarketing(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#003882] focus:ring-[#003882] accent-[#003882] cursor-pointer shrink-0"
                />
                <label 
                  htmlFor="aceita_marketing" 
                  className="text-xs text-slate-700 leading-snug cursor-pointer select-none"
                >
                  Quero receber dicas para a minha obra e ofertas da <strong className="text-slate-900 font-semibold">Phoenix Elétrica</strong> por e-mail.
                </label>
              </div>

              {/* Caixa de verificação do Cloudflare Turnstile (Proteção contra bots) */}
              <div className="flex flex-col items-center justify-center my-3 min-h-[65px]">
                <div 
                  ref={turnstileContainerRef}
                  className="cf-turnstile" 
                  data-sitekey={TURNSTILE_SITE_KEY}
                ></div>
                <div className="flex items-center gap-1.5 text-[11px] mt-1">
                  <ShieldCheck className={`w-3.5 h-3.5 ${turnstileToken ? 'text-emerald-600' : 'text-blue-600'}`} />
                  <span className={turnstileToken ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                    {turnstileToken ? '✓ Verificação de segurança aprovada' : 'Proteção contra bots ativa (Cloudflare Turnstile)'}
                  </span>
                </div>
              </div>

              {/* Botão de Envio Principal com Efeito de Escala e Microinteração */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-sm sm:text-base py-3.5 px-6 rounded-md shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>SOLICITAR COTAÇÃO</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>
          )}

        </div>

      </div>
    </motion.section>
  );
};

