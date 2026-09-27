/**
 * Helper de rastreamento de eventos executivos (Phoenix Elétrica)
 */
export const trackWhatsAppClick = (origem: string, rotulo?: string) => {
  try {
    if (typeof fetch === 'function') {
      fetch('/api/eventos/clique-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem: origem || 'Botão Flutuante (WhatsApp)',
          rotulo: rotulo || 'WhatsApp Oficial'
        })
      }).catch(() => {});
    }
  } catch (_) {
    // Tolerante a falhas
  }
};
