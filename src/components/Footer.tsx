import React, { useRef } from 'react';
import { MessageSquare, MapPin, Clock, Phone, Mail, ShieldCheck, FileText } from 'lucide-react';
import { PhoenixLogo } from './PhoenixLogo';
import { navCategories } from './Header';
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
    <footer id="contato" className="bg-[#050f26] text-slate-400 text-sm">
      <div className="h-1 bg-gradient-to-r from-brand-blue via-brand-yellow to-brand-red" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4 space-y-4">
            <div className="inline-block rounded-2xl bg-white px-3 py-2">
              <PhoenixLogo variant="horizontal" size="sm" />
            </div>
            <p className="max-w-xs leading-relaxed">
              Materiais elétricos de primeira linha para construtoras, indústrias e instaladores.
            </p>
            <div className="flex items-center gap-2 text-brand-yellow text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              Produtos homologados e certificados
            </div>
          </div>

          <div className="md:col-span-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-4">Produtos</h2>
            <ul className="space-y-2.5">
              {navCategories.map((item) => (
                <li key={item.targetId}>
                  <a href={item.path} className="hover:text-white transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-4">Atendimento</h2>
            <address className="not-italic">
            <ul className="space-y-3">
              <li>
                <a href="/cotacao" className="flex items-center gap-3 font-semibold text-brand-yellow hover:text-white transition-colors">
                  <FileText className="w-4 h-4 shrink-0" />
                  Faça sua cotação
                </a>
              </li>
              <li>
                <a href="tel:1133527777" className="flex items-center gap-3 hover:text-white transition-colors">
                  <Phone className="w-4 h-4 text-brand-yellow shrink-0" />
                  (11) 3352-7777
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/5511983239782"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick('Rodapé da Loja', 'WhatsApp Cotações Link')}
                  className="flex items-center gap-3 hover:text-white transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-[#25D366] shrink-0" />
                  (11) 98323-9782
                </a>
              </li>
              <li>
                <a href="mailto:phoenix@phoenixel.com.br" className="flex items-center gap-3 hover:text-white transition-colors">
                  <Mail className="w-4 h-4 text-brand-yellow shrink-0" />
                  phoenix@phoenixel.com.br
                </a>
              </li>
              <li>
                <a
                  href="https://maps.google.com/?q=R.+Anhaia,+740+-+Bom+Retiro,+S%C3%A3o+Paulo+-+SP,+01130-000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 hover:text-white transition-colors"
                >
                  <MapPin className="w-4 h-4 text-brand-yellow shrink-0 mt-0.5" />
                  R. Anhaia, 740 · Bom Retiro, São Paulo - SP · 01130-000
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                Seg a sex, 08:00 às 17:30
              </li>
            </ul>
            </address>
          </div>
        </div>

        {/* Barra inferior (gatilho discreto por 3 cliques no copyright) */}
        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p onClick={handleSecretClick} className="cursor-default select-none">
            © 2026 Phoenix Elétrica. Todos os direitos reservados.
          </p>
          <p>CNPJ 45.128.940/0001-82</p>
        </div>
      </div>
    </footer>
  );
};
