import React, { useRef } from 'react';
import { MessageSquare, MapPin, Clock, Phone, Mail, ShieldCheck } from 'lucide-react';
import { trackWhatsAppClick } from '../utils/analytics';

interface FooterProps {
  onSecretAdminTrigger?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onSecretAdminTrigger }) => {
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Gatilho secreto: 3 cliques no rodapé abrem a tela de login administrativo
  const handleSecretClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      if (onSecretAdminTrigger) {
        onSecretAdminTrigger();
      }
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 1200);
    }
  };

  return (
    <footer className="bg-[#00224d] text-slate-300 text-xs border-t-4 border-[#d31010]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Coluna 1: Informações Institucionais */}
          <div className="md:col-span-5 space-y-3">
            <div>
              <h3 className="text-base font-extrabold text-white tracking-wide uppercase">
                Phoenix Elétrica
              </h3>
              <span className="text-[11px] text-yellow-300 font-semibold tracking-wider uppercase block">
                Distribuidora de Materiais Elétricos
              </span>
            </div>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-sm">
              Distribuidora especializada no fornecimento ágil e seguro de materiais elétricos de primeira linha para construtoras, indústrias, engenheiros e instaladores em geral.
            </p>

            <div className="space-y-1 text-xs text-slate-400">
              <div>CNPJ: 45.128.940/0001-82 · Inscrição Estadual Ativa</div>
              <div className="flex items-center gap-1.5 text-yellow-300 font-semibold pt-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Produtos 100% Homologados e Certificados</span>
              </div>
            </div>
          </div>

          {/* Coluna 2: Departamentos & Categorias (Apenas links públicos, sem botões de admin) */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white border-b border-blue-900 pb-2">
              Departamentos
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <a href="#fios-cabos" className="hover:text-yellow-300 transition-colors">
                  Fios e Cabos por Metro e Rolo
                </a>
              </li>
              <li>
                <a href="#disjuntores-quadros" className="hover:text-yellow-300 transition-colors">
                  Disjuntores & Quadros DIN
                </a>
              </li>
              <li>
                <a href="#iluminacao-led" className="hover:text-yellow-300 transition-colors">
                  Iluminação LED & Refletores
                </a>
              </li>
              <li>
                <a href="#infraestrutura" className="hover:text-yellow-300 transition-colors">
                  Infraestrutura & Eletrodutos
                </a>
              </li>
              <li>
                <a href="#tomadas-acabamentos" className="hover:text-yellow-300 transition-colors">
                  Tomadas e Interruptores
                </a>
              </li>
              <li>
                <a href="#automacao-comandos" className="hover:text-yellow-300 transition-colors">
                  Automação & Comandos
                </a>
              </li>
              <li>
                <a href="#orcamento" className="hover:text-yellow-300 transition-colors">
                  Cotação para Empresas (Boleto CNPJ)
                </a>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Central de Atendimento & Horários */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white border-b border-blue-900 pb-2">
              Televendas & Loja Física
            </h4>
            
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-yellow-300 shrink-0" />
                <a href="tel:1133527777" className="hover:text-yellow-300 transition-colors">
                  Telefone Comercial: <strong>(11) 3352-7777</strong>
                </a>
              </div>

              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                <a 
                  href="https://wa.me/5511983239782" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={() => trackWhatsAppClick('Rodapé da Loja', 'WhatsApp Cotações Link')}
                  className="hover:text-yellow-300 transition-colors text-emerald-300 font-semibold"
                >
                  WhatsApp Cotações: (11) 98323-9782
                </a>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                <span>
                  <strong>Loja Física:</strong> R. Anhaia, 740 - Bom Retiro, São Paulo - SP, CEP: 01130-000
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-yellow-300 shrink-0" />
                <a href="mailto:orcamentos@phoenixeletrica.com.br" className="hover:text-yellow-300 transition-colors">
                  E-mail: orcamentos@phoenixeletrica.com.br
                </a>
              </div>

              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Horário: Segunda a Sexta, das 07:30 às 17:30</span>
              </div>
            </div>

            {/* Botão de Contato Oficial */}
            <div className="pt-2">
              <a
                href="https://wa.me/5511983239782?text=Ol%C3%A1!%20Gostaria%20de%20um%20or%C3%A7amento%20de%20materiais%20el%C3%A9tricos%20com%20a%20Phoenix%20El%C3%A9trica."
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('Rodapé da Loja', 'WhatsApp Comercial Rodapé')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[#25D366] hover:bg-[#20ba5a] text-white transition-colors text-xs font-bold shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5 fill-current" />
                <span>Falar com Vendedor Técnico no WhatsApp</span>
              </a>
            </div>
          </div>

        </div>

        {/* Barra Inferior de Direitos (Sem botões de admin visíveis; gatilho discreto por 3 cliques no texto) */}
        <div className="mt-10 pt-5 border-t border-blue-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p 
            onClick={handleSecretClick}
            className="cursor-default select-none"
            title=""
          >
            © 2026 Phoenix Elétrica. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <p>Distribuição de materiais elétricos de alta qualidade e procedência.</p>
          </div>
        </div>

      </div>
    </footer>
  );
};
