import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, MessageSquare, CheckCircle2, AlertCircle, ArrowRight, 
  ShieldCheck, Clock, ExternalLink, Paperclip, Upload, FileText, X 
} from 'lucide-react';
import { trackWhatsAppClick } from '../utils/analytics';

interface QuoteFormProps {
  initialMaterial?: string;
  onLeadSubmitted?: () => void;
}

export const QuoteForm: React.FC<QuoteFormProps> = ({ initialMaterial = '', onLeadSubmitted }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [materiais, setMateriais] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivoInfo, setArquivoInfo] = useState<{ nome: string; tamanho: string } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [aceitaMarketing, setAceitaMarketing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [successData, setSuccessData] = useState<{
    leadId: number;
    redirectUrl: string;
    fileUrl?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Função centralizada para redirecionar obrigatoriamente para o WhatsApp
  const triggerWhatsAppRedirect = (url: string) => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    let opened = false;

    // 1. Tenta abrir a conversa diretamente via window.open
    try {
      const newWin = window.open(url, '_blank', 'noopener,noreferrer');
      if (newWin && !newWin.closed && typeof newWin.closed !== 'undefined') {
        opened = true;
      }
    } catch (e) {
      console.warn('Tentativa window.open:', e);
    }

    // 2. Se for fora do iframe (celular, app, ou navegador normal) ou se window.open foi bloqueado
    if (!isIframe) {
      window.location.href = url;
    } else if (!opened) {
      // Cria clique de link como fallback para navegadores com restrição em iframe
      try {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (_) {}
    }
  };

  // Efeito de contagem regressiva e garantia de redirecionamento automático
  useEffect(() => {
    if (!successData?.redirectUrl) return;

    // Dispara o redirecionamento imediato
    triggerWhatsAppRedirect(successData.redirectUrl);

    // Contagem regressiva de segurança para reforçar o redirecionamento
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          triggerWhatsAppRedirect(successData.redirectUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
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

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanNome = nome.trim();
    const cleanEmail = email.trim();
    const cleanTelefone = telefone.trim();
    const cleanCidade = cidade.trim();
    const cleanMateriais = materiais.trim();

    // Cliente pode digitar os materiais OU anexar arquivo (PDF, Word, etc.)
    const hasMaterialsOrFile = cleanMateriais || arquivoInfo;
    if (!cleanNome || !cleanTelefone || !cleanCidade || !hasMaterialsOrFile) {
      setErrorMsg('Por favor, informe seu nome, telefone, cidade e a relação de materiais (digitada ou em anexo).');
      return;
    }

    if (cleanTelefone.replace(/\D/g, '').length < 10) {
      setErrorMsg('Por favor, informe um número de telefone com DDD válido.');
      return;
    }

    setIsLoading(true);

    // Garante que o arquivo tenha URL pública gerada no servidor antes de montar o WhatsApp
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    let finalFileUrl = uploadedFileUrl;
    if (arquivo && !finalFileUrl) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(arquivo);
        });
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: arquivo.name,
            fileBase64: base64,
            fileSize: arquivoInfo?.tamanho || '',
            clientOrigin: currentOrigin
          })
        });
        const uploadData = await uploadRes.json();
        if (uploadData.url || uploadData.safeFileName) {
          const rawUrl = uploadData.url || `${currentOrigin}/uploads/${uploadData.safeFileName}`;
          finalFileUrl = rawUrl.replace('http://localhost:3000', currentOrigin);
          setUploadedFileUrl(finalFileUrl);
        }
      } catch (err) {
        console.warn('Upload sincronizado falhou, prosseguindo com link de texto:', err);
      }
    }

    if (finalFileUrl && finalFileUrl.includes('localhost:3000')) {
      finalFileUrl = finalFileUrl.replace('http://localhost:3000', currentOrigin);
    }

    // Formata a relação de materiais considerando texto ou arquivo
    let descricaoMateriais = cleanMateriais;
    if (arquivoInfo) {
      if (!descricaoMateriais) {
        descricaoMateriais = `[Arquivo em Anexo: ${arquivoInfo.nome}]`;
      } else {
        descricaoMateriais = `${cleanMateriais} (Anexo incluso: ${arquivoInfo.nome})`;
      }
    }

    // Monta a mensagem estruturada para o WhatsApp da Phoenix Elétrica (sem emojis propensos a bug de codificação)
    const whatsappNumber = '5511983239782';
    let textMessage = '';

    if (finalFileUrl) {
      textMessage = `Olá! Meu nome é ${cleanNome}, sou de ${cleanCidade}. Gostaria de solicitar um orçamento para a Phoenix Elétrica:\n\n` +
        (cleanMateriais ? `*Relação de Materiais:* ${cleanMateriais}\n\n` : '') +
        `*Arquivo em Anexo:* ${arquivoInfo?.nome} (${arquivoInfo?.tamanho})\n` +
        `*Link para Visualizar / Baixar:* ${finalFileUrl}\n\n` +
        `Telefone de contato: ${cleanTelefone}.`;
    } else if (arquivoInfo && !cleanMateriais) {
      textMessage = `Olá! Meu nome é ${cleanNome}, sou de ${cleanCidade}. Gostaria de solicitar um orçamento para a relação de materiais que tenho em anexo: ${arquivoInfo.nome} (${arquivoInfo.tamanho}). Meu telefone de contato é ${cleanTelefone}.`;
    } else {
      textMessage = `Olá! Meu nome é ${cleanNome}, sou de ${cleanCidade} e gostaria de solicitar um orçamento para os seguintes materiais: ${descricaoMateriais}. Meu telefone de contato é ${cleanTelefone}.`;
    }

    const encodedMessage = encodeURIComponent(textMessage);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    const googlePayload = {
      nome: cleanNome,
      email: cleanEmail,
      telefone: cleanTelefone,
      cidade: cleanCidade,
      materiais: descricaoMateriais,
      arquivo_nome: arquivoInfo?.nome || '',
      arquivo_tamanho: arquivoInfo?.tamanho || '',
      arquivo_url: finalFileUrl || '',
      aceita_marketing: aceitaMarketing
    };

    try {
      // 1. Envio rápido para o banco SQLite local e Google Sheets em paralelo com keepalive
      const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbysMnEiNhjeS9fcluVrlauETz-C0sWhCM6MaPord5AFUuOozIpznL3JzLeQP4Khd7E/exec';

      // Dispara as requisições sem travar o redirecionamento obrigatório
      const savePromises = [
        fetch('/api/orcamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googlePayload),
          keepalive: true
        }).catch((err) => console.warn('Aviso DB SQLite:', err)),
        
        fetch(googleScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(googlePayload),
          keepalive: true
        }).catch((err) => console.warn('Aviso Sheets:', err))
      ];

      // Aguarda no máximo 700ms para salvar localmente antes do redirecionamento
      await Promise.race([
        Promise.allSettled(savePromises),
        new Promise((resolve) => setTimeout(resolve, 700))
      ]);

      // 2. Notifica atualização de métricas e contadores
      if (onLeadSubmitted) {
        onLeadSubmitted();
      }

      trackWhatsAppClick('Formulário de Cotação', 'Fazer Orçamento & Redirecionar WhatsApp');

      // 3. Executa o redirecionamento imediato no momento do clique (conservando o gesto do usuário)
      triggerWhatsAppRedirect(whatsappUrl);

      // 4. Ativa a tela de confirmação com garantia de redirecionamento obrigatório
      setSuccessData({
        leadId: Date.now(),
        redirectUrl: whatsappUrl,
        fileUrl: finalFileUrl || undefined
      });

    } catch (err: any) {
      console.error('Exceção capturada:', err);
      // Mesmo se houver erro de rede, garante o redirecionamento do cliente para o WhatsApp
      triggerWhatsAppRedirect(whatsappUrl);
      setSuccessData({
        leadId: Date.now(),
        redirectUrl: whatsappUrl,
        fileUrl: finalFileUrl || undefined
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="orcamento" className="py-8 sm:py-16 bg-[#f4f6f9] border-b border-slate-200 relative">
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

          {/* Estado de Sucesso com Redirecionamento Obrigatório Ativo */}
          {successData ? (
            <div className="py-6 sm:py-10 text-center space-y-5 animate-fadeIn">
              
              {/* Ícone Animado do WhatsApp */}
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg">
                  <MessageSquare className="w-8 h-8 fill-current" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Orçamento Registrado com Sucesso!</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 max-w-lg mx-auto">
                  Em breve, um de nossos vendedores entrará em contato com você
                </h3>

                {countdown > 0 && (
                  <p className="text-[11px] font-semibold text-slate-500">
                    Redirecionamento automático em <span className="text-[#004b9c] font-bold text-xs">{countdown}s</span>...
                  </p>
                )}

                {arquivoInfo && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium mt-1">
                    <Paperclip className="w-3.5 h-3.5 text-[#004b9c]" />
                    <span>Arquivo registrado: <strong>{arquivoInfo.nome}</strong> ({arquivoInfo.tamanho})</span>
                  </div>
                )}
              </div>

              {/* Pré-visualização limpa da mensagem enviada */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-left max-w-lg mx-auto text-xs text-slate-700 space-y-1.5">
                <div className="text-slate-500 font-semibold flex items-center justify-between">
                  <span>Mensagem pronta no WhatsApp:</span>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">Pronta para envio</span>
                </div>
                <div className="bg-white p-3.5 rounded border border-slate-200 text-slate-800 leading-relaxed text-xs whitespace-pre-line font-sans">
                  {successData.fileUrl ? (
                    <>
                      Olá! Meu nome é {nome}, sou de {cidade}. Gostaria de solicitar um orçamento para a Phoenix Elétrica:<br /><br />
                      {materiais && <><strong>Relação de Materiais:</strong> {materiais}<br /><br /></>}
                      <strong>Arquivo em Anexo:</strong> {arquivoInfo?.nome} ({arquivoInfo?.tamanho})<br />
                      <strong>Link para Visualizar / Baixar:</strong><br />
                      <span className="text-[#004b9c] font-mono break-all">{successData.fileUrl}</span><br /><br />
                      Telefone de contato: {telefone}.
                    </>
                  ) : (
                    `Olá! Meu nome é ${nome}, sou de ${cidade} e gostaria de solicitar um orçamento para os seguintes materiais: ${materiais || (arquivoInfo ? `[Arquivo em anexo: ${arquivoInfo.nome}]` : '')}. Meu telefone de contato é ${telefone}.`
                  )}
                </div>
              </div>

              {/* Botão de Ação Direta Principal para Garantir o Acesso em Qualquer Dispositivo */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={successData.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick('Formulário de Cotação', 'Abrir WhatsApp Manual Pós-Envio')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-sm sm:text-base px-8 py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <MessageSquare className="w-5 h-5 fill-current" />
                  <span>ABRIR WHATSAPP AGORA</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    let texto = '';
                    if (successData.fileUrl) {
                      texto = `Olá! Meu nome é ${nome}, sou de ${cidade}. Gostaria de solicitar um orçamento para a Phoenix Elétrica:\n\n` +
                        (materiais ? `*Relação de Materiais:* ${materiais}\n\n` : '') +
                        `*Arquivo em Anexo:* ${arquivoInfo?.nome} (${arquivoInfo?.tamanho})\n` +
                        `*Link para Visualizar / Baixar:* ${successData.fileUrl}\n\n` +
                        `Telefone de contato: ${telefone}.`;
                    } else {
                      const desc = materiais || (arquivoInfo ? `[Arquivo em anexo: ${arquivoInfo.nome}]` : '');
                      texto = `Olá! Meu nome é ${nome}, sou de ${cidade} e gostaria de solicitar um orçamento para os seguintes materiais: ${desc}. Meu telefone de contato é ${telefone}.`;
                    }
                    navigator.clipboard.writeText(texto);
                    alert('Texto da mensagem copiado para a área de transferência!');
                  }}
                  className="w-full sm:w-auto text-xs text-slate-700 hover:text-slate-900 px-4 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 font-medium transition-colors"
                >
                  Copiar Mensagem
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSuccessData(null);
                    setNome('');
                    setTelefone('');
                    setCidade('');
                    setMateriais('');
                    setArquivo(null);
                    setArquivoInfo(null);
                    setAceitaMarketing(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 px-4 py-2 transition-colors cursor-pointer"
                >
                  Fazer outro orçamento
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
                    E-mail
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) handleProcessFile(droppedFile);
                    }}
                    className="border-2 border-dashed border-slate-300 hover:border-[#004b9c] bg-slate-50/80 hover:bg-blue-50/40 rounded-lg p-4 sm:p-5 text-center cursor-pointer transition-all group"
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
                      <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#004b9c] group-hover:scale-110 transition-transform shrink-0">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-center sm:text-left">
                        <div className="text-xs sm:text-sm font-semibold text-slate-800">
                          Clique para anexar seu arquivo ou arraste para cá
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Aceita <strong>PDF, Word (.doc, .docx), Excel (.xlsx, .csv)</strong> ou fotos de projetos e listas até 15MB
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

              {/* Campo: Materiais / Lista de Compras */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="materiais" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Produto(s) / Lista de Materiais {arquivoInfo ? (
                      <span className="text-[11px] text-emerald-700 font-normal lowercase">(opcional se já anexou o arquivo acima)</span>
                    ) : (
                      <span className="text-[#d31010]">*</span>
                    )}
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {arquivoInfo ? 'Adicione observações se desejar' : 'Cole sua relação ou descreva os itens'}
                  </span>
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

              {/* Botão de Envio Principal */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-sm sm:text-base py-3.5 px-6 rounded-md shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Salvando orçamento e abrindo WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-5 h-5 fill-current" />
                    <span>FAZER ORÇAMENTO NO WHATSAPP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>
          )}

        </div>

      </div>
    </section>
  );
};

