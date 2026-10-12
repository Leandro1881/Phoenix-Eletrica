import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, MessageSquare, CheckCircle2, AlertCircle, ArrowRight, 
  ShieldCheck, Clock, ExternalLink, Paperclip, Upload, FileText, X,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { trackWhatsAppClick } from '../utils/analytics';
import { AiQuoteAssistant } from './AiQuoteAssistant';

interface QuoteFormProps {
  initialMaterial?: string;
  onLeadSubmitted?: () => void;
  onOpenAiAssistant?: () => void;
}

// URL do endpoint oficial da AWS Lambda para captação de leads
const AWS_LAMBDA_URL = 'https://rl4eobl3ypivmz3vzx6npkj6e40ldowj.lambda-url.us-east-2.on.aws/';

// Mesma chave real em dev e prod. Para dev, "localhost" precisa estar liberado no widget do painel Cloudflare.
const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '0x4AAAAAAFHknypuoYSkLpBF';

// Token fixo das chaves de teste do Turnstile: a Lambda recusa, então vai direto ao proxy local
const TURNSTILE_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

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

  const formatFileSize = (size: number) =>
    size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;

  // Envia o arquivo ao servidor e devolve o link público (ou null se falhar)
  const uploadFile = (file: File): Promise<string | null> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileBase64: reader.result as string,
              fileSize: formatFileSize(file.size)
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setErrorMsg(data.message || 'Não foi possível enviar o arquivo.');
            return resolve(null);
          }
          resolve(data.url || null);
        } catch (uploadErr) {
          console.warn('Falha no upload do anexo:', uploadErr);
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  // Processa o arquivo selecionado ou arrastado e realiza o upload imediatamente
  const handleProcessFile = async (file: File) => {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('O arquivo selecionado ultrapassa o limite de 15MB. Por favor, escolha um arquivo menor.');
      return;
    }

    setArquivo(file);
    setArquivoInfo({ nome: file.name, tamanho: formatFileSize(file.size) });
    setUploadedFileUrl(null);
    setErrorMsg(null);

    setIsUploadingFile(true);
    const url = await uploadFile(file);
    setUploadedFileUrl(url);
    setIsUploadingFile(false);
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

  // Abre a aba já no clique (gesto do usuário); senão o navegador bloqueia como pop-up
  const openPendingWhatsAppTab = (): Window | null => {
    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.title = 'Abrindo WhatsApp...';
        win.document.body.innerHTML =
          '<p style="font-family:sans-serif;text-align:center;margin-top:40vh;color:#334155">Abrindo o WhatsApp da Phoenix Elétrica...</p>';
      }
      return win;
    } catch {
      return null;
    }
  };

  const redirectToWhatsApp = (win: Window | null, url: string) => {
    if (win && !win.closed) {
      win.opener = null;
      win.location.href = url;
    } else {
      // Pop-up bloqueado: segue na mesma aba
      window.location.href = url;
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
          'refresh-expired': 'auto',
          'error-callback': (errorCode: string) => {
            console.warn('Turnstile error-callback:', errorCode);
            if (!isMounted) return;
            setTurnstileToken('');
            if (String(errorCode).startsWith('1102')) {
              setErrorMsg(`Verificação de segurança indisponível neste domínio (${window.location.hostname}). Adicione-o ao widget Turnstile no painel Cloudflare.`);
            }
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
    const effectiveToken = turnstileToken || turnstileInput?.value || '';

    if (!effectiveToken) {
      setErrorMsg('Por favor, conclua a verificação de segurança do Cloudflare Turnstile antes de solicitar a cotação.');
      return;
    }

    if (isUploadingFile) {
      setErrorMsg('Aguarde o envio do arquivo terminar.');
      return;
    }

    // UX/UI: Ativa estado de carregamento e desabilita botão para evitar cliques duplos
    setIsLoading(true);
    const whatsappTab = openPendingWhatsAppTab();

    try {
      // 4. Formato do Payload (JSON): {"nome": nomeCliente, "email": emailCliente, "token": tokenCloudflare}
      const lambdaPayload = {
        nome: cleanNome,
        email: cleanEmail,
        token: effectiveToken
      };

      // 5. Requisição HTTP (Fetch) POST: tenta envio direto (quando não for token de bypass) e aciona proxy em caso de erro/CORS
      let lambdaSuccess = false;
      if (effectiveToken !== TURNSTILE_TEST_TOKEN) {
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
      let finalFileUrl = uploadedFileUrl;
      // Upload anterior falhou: tenta de novo antes de montar a mensagem
      if (arquivo && !finalFileUrl) {
        finalFileUrl = await uploadFile(arquivo);
        setUploadedFileUrl(finalFileUrl);
      }
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
      redirectToWhatsApp(whatsappTab, whatsappUrl);

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
      whatsappTab?.close();
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


  const inputClass =
    'w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm transition-all outline-none';
  const labelClass = 'block text-[13px] font-semibold text-slate-700 mb-1.5';

  const steps = [
    { icon: FileText, title: 'Envie sua lista', text: 'Digitada ou em arquivo' },
    { icon: ShieldCheck, title: 'Conferimos tudo', text: 'Equipe técnica revisa' },
    { icon: MessageSquare, title: 'Proposta no WhatsApp', text: 'Retorno médio de 15 min' }
  ];

  return (
    <section id="orcamento" className="py-16 sm:py-24 bg-surface relative scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden bg-white shadow-[0_30px_80px_-30px_rgba(8,22,52,0.35)] ring-1 ring-slate-200/70"
        >
          {/* Painel lateral: como funciona */}
          <div className="lg:col-span-5 relative bg-brand-navy text-white p-7 sm:p-10 overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-60" />
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-blue/50 blur-3xl animate-glow" />
            <div className="absolute -bottom-28 -left-16 w-64 h-64 rounded-full bg-brand-yellow/15 blur-3xl" />

            <div className="relative h-full flex flex-col">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-yellow ring-1 ring-white/15">
                <Clock className="w-3.5 h-3.5" />
                Resposta rápida
              </span>
              <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1]">
                Sua cotação em <span className="text-brand-yellow">minutos</span>.
              </h2>
              <p className="mt-3 text-sm text-blue-100/80 max-w-sm">
                Mande a lista e receba a proposta direto no WhatsApp.
              </p>

              <ol className="mt-8 space-y-5">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <motion.li
                      key={step.title}
                      initial={{ opacity: 0, x: -16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.12, duration: 0.45 }}
                      className="flex items-center gap-4"
                    >
                      <div className="relative w-11 h-11 rounded-2xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-brand-yellow" />
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-red text-[10px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-sm">{step.title}</div>
                        <div className="text-xs text-blue-100/70">{step.text}</div>
                      </div>
                    </motion.li>
                  );
                })}
              </ol>

              <div className="mt-auto pt-10 hidden lg:flex items-center gap-2 text-xs text-blue-100/60">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Dados protegidos conforme a LGPD
              </div>
            </div>
          </div>

          {/* Formulário */}
          <div className="lg:col-span-7 p-6 sm:p-10">
            {successData ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="h-full flex flex-col items-center justify-center text-center py-8 space-y-5"
              >
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping" />
                  <div className="relative w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                </div>

                <div className="space-y-2 max-w-md">
                  <h3 className="text-2xl font-extrabold text-slate-900">Cotação enviada!</h3>
                  <p className="text-sm text-slate-600">
                    Obrigado, <strong>{successData.nome}</strong>. Abrimos o WhatsApp do vendedor para agilizar sua proposta.
                  </p>
                  {arquivoInfo && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-blue-soft text-brand-blue-dark text-xs font-medium">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[220px]">{arquivoInfo.nome}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                  {successData.redirectUrl && (
                    <a
                      href={successData.redirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackWhatsAppClick('Formulário de Cotação', 'Abrir WhatsApp Manual Pós-Envio')}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1fb257] text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5"
                    >
                      <MessageSquare className="w-4 h-4 fill-current" />
                      Abrir WhatsApp
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
                    className="w-full sm:w-auto text-sm text-slate-700 px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold transition-colors cursor-pointer"
                  >
                    Nova cotação
                  </button>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence>
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="nome" className={labelClass}>Nome</label>
                    <input type="text" id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" placeholder="Seu nome completo" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="email" className={labelClass}>E-mail</label>
                    <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="voce@empresa.com" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="telefone" className={labelClass}>WhatsApp</label>
                    <input type="tel" id="telefone" value={telefone} onChange={handleTelefoneChange} required autoComplete="tel" placeholder="(11) 90000-0000" maxLength={15} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="cidade" className={labelClass}>Cidade / UF</label>
                    <input type="text" id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} required placeholder="São Paulo - SP" className={inputClass} />
                  </div>
                </div>

                {/* Materiais */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="materiais" className="text-[13px] font-semibold text-slate-700">
                      Lista de materiais {arquivoInfo && <span className="font-normal text-slate-400">(opcional)</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => (onOpenAiAssistant ? onOpenAiAssistant() : setShowAiAssistant((prev) => !prev))}
                      className="group inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue hover:text-brand-blue-dark cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
                      Montar com IA
                    </button>
                  </div>
                  <textarea
                    id="materiais"
                    value={materiais}
                    onChange={(e) => setMateriais(e.target.value)}
                    rows={arquivoInfo ? 2 : 4}
                    required={!arquivoInfo}
                    placeholder={arquivoInfo ? 'Observações, marcas ou prazo (opcional)' : 'Ex: 3 rolos cabo flexível 2,5mm², 4 disjuntores 20A curva C...'}
                    className={`${inputClass} resize-none leading-relaxed`}
                  />
                </div>

                {!onOpenAiAssistant && showAiAssistant && (
                  <AiQuoteAssistant
                    onApplyMaterials={handleApplyAiMaterials}
                    onClose={() => setShowAiAssistant(false)}
                    currentMaterials={materiais}
                  />
                )}

                {/* Anexo */}
                <input
                  ref={fileInputRef}
                  type="file"
                  id="arquivo-anexo"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.odt,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                />
                {!arquivoInfo ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                    }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) handleProcessFile(droppedFile);
                    }}
                    className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3.5 cursor-pointer transition-all duration-300 group ${
                      isDragging
                        ? 'border-brand-blue bg-brand-blue-soft scale-[1.01]'
                        : 'border-slate-200 hover:border-brand-blue/60 hover:bg-brand-blue-soft/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      isDragging ? 'bg-brand-blue text-white animate-bounce' : 'bg-brand-blue-soft text-brand-blue group-hover:scale-110'
                    }`}>
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">
                        {isDragging ? 'Solte o arquivo aqui' : 'Anexar lista ou projeto'}
                      </div>
                      <div className="text-xs text-slate-500">PDF, Word, Excel ou foto · até 15MB</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-brand-blue-soft ring-1 ring-brand-blue/15">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-blue text-white flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate" title={arquivoInfo.nome}>{arquivoInfo.nome}</div>
                        <div className="text-xs text-slate-500">
                          {arquivoInfo.tamanho} ·{' '}
                          {isUploadingFile ? (
                            <span className="text-amber-600 font-medium animate-pulse">enviando...</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">{uploadedFileUrl ? 'link pronto' : 'pronto'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={handleRemoveFile} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer" title="Remover anexo">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* LGPD */}
                <label htmlFor="aceita_marketing" className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="aceita_marketing"
                    name="aceita_marketing"
                    checked={aceitaMarketing}
                    onChange={(e) => setAceitaMarketing(e.target.checked)}
                    className="h-4 w-4 rounded accent-brand-blue cursor-pointer shrink-0"
                  />
                  Quero receber ofertas da Phoenix Elétrica por e-mail
                </label>

                {/* Cloudflare Turnstile */}
                <div className="flex justify-center min-h-[65px]">
                  <div ref={turnstileContainerRef} className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isUploadingFile}
                  className="group relative w-full inline-flex items-center justify-center gap-2 overflow-hidden bg-brand-blue hover:bg-brand-blue-dark text-white font-bold text-base py-4 px-6 rounded-xl shadow-lg shadow-brand-blue/30 transition-all duration-300 cursor-pointer disabled:opacity-60 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  {isLoading || isUploadingFile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isUploadingFile ? 'Enviando arquivo...' : 'Enviando...'}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Solicitar cotação
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Protegido por Cloudflare · sem spam
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
