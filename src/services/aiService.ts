import { GoogleGenAI } from '@google/genai';

/**
 * System Prompt com Guardrails estritos para a Phoenix Elétrica
 * Conforme especificação obrigatória:
 */
export const PHOENIX_SYSTEM_PROMPT = `És um assistente técnico de vendas da Phoenix Elétrica, em São Paulo. A tua ÚNICA função é ajudar o cliente a montar uma lista de materiais elétricos clara para orçamento. REGRAS ESTRITAS: 1. NUNCA forneça preços, descontos ou prazos. Responda que o balcão calculará isso. 2. Se o assunto não for material elétrico/obras, responda EXATAMENTE: 'Sou especialista apenas em materiais elétricos. Como posso ajudar com a sua lista?'. 3. Sugira itens complementares lógicos (ex: fita isolante para cabos), mas se o cliente dispensar ou disser que não precisa, NÃO inclua na lista. 4. Mantenha as respostas curtas e objetivas. 5. Quando o cliente finalizar a lista, retorne a lista estruturada contendo ESTRITAMENTE os materiais confirmados ou pedidos pelo cliente na conversa (sem adicionar itens que o cliente não pediu ou dispensou), com marcadores (•), e confirme que está pronta para envio ao balcão.`;

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isFinalList?: boolean;
}

/**
 * Normaliza termos e corrige typos técnicos comuns de cabos e bitolas
 * Ex: "15.mm2 core azul" -> "1,5mm² cor azul"
 */
export function normalizeSpec(text: string): string {
  let s = text.trim();

  // Corrige typos comuns de teclado mobile em bitolas (ex: 15.mm2, 15mm2 -> 1,5mm²)
  s = s.replace(/\b15\.?mm[²2]?\b/gi, '1,5mm²');
  s = s.replace(/\b1[.,]5\s*mm[²2]?\b/gi, '1,5mm²');
  s = s.replace(/\b25\.?mm[²2]?\b/gi, '2,5mm²');
  s = s.replace(/\b2[.,]5\s*mm[²2]?\b/gi, '2,5mm²');
  s = s.replace(/\b4\.?0?\s*mm[²2]?\b/gi, '4mm²');
  s = s.replace(/\b6\.?0?\s*mm[²2]?\b/gi, '6mm²');
  s = s.replace(/\b10\.?0?\s*mm[²2]?\b/gi, '10mm²');
  s = s.replace(/\b16\.?0?\s*mm[²2]?\b/gi, '16mm²');

  // Limpa possíveis duplicações de expoente ²
  s = s.replace(/²+/g, '²');

  // Corrige typo 'core' para 'cor'
  s = s.replace(/\bcore\s+/gi, 'cor ');

  return s;
}

function formatCableItem(c: { quantity?: string; gauge?: string; color?: string; name?: string }): string {
  const parts: string[] = [];

  if (c.quantity) {
    parts.push(c.quantity);
    parts.push('de');
  }

  parts.push(c.name || 'cabo flexível');

  if (c.gauge) {
    parts.push(c.gauge);
  }

  if (c.color) {
    parts.push(`- ${c.color}`);
  }

  const raw = parts.join(' ').replace(/\s+/g, ' ').trim();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Consolida itens interdependentes de uma mesma especificação (ex: "3 rolos" + "1,5mm² cor azul")
 * para que não sejam listados como produtos separados, e sim como um único produto completo.
 */
export function consolidateMaterials(rawCandidates: string[]): string[] {
  if (rawCandidates.length === 0) return [];
  if (rawCandidates.length === 1) {
    const single = normalizeSpec(rawCandidates[0]);
    if (/^\d+\s*rolos?$/i.test(single)) {
      return [`${single} de cabo flexível`];
    }
    return [single];
  }

  const result: string[] = [];
  let pendingCable: { quantity?: string; gauge?: string; color?: string; name?: string } | null = null;

  for (const item of rawCandidates) {
    const norm = normalizeSpec(item);
    const lower = norm.toLowerCase();

    // Produtos independentes que não se misturam com cabos
    const isDistinctNonCable = 
      lower.includes('iluminação') || lower.includes('led') || lower.includes('lâmpada') || 
      lower.includes('refletor') || lower.includes('fita') || lower.includes('eletroduto') || 
      lower.includes('tomada') || lower.includes('interruptor') || lower.includes('caixa 4x2') || 
      lower.includes('canaleta') || lower.includes('disjuntor') || lower.includes('wago');

    if (isDistinctNonCable) {
      if (pendingCable) {
        result.push(formatCableItem(pendingCable));
        pendingCable = null;
      }
      result.push(norm);
      continue;
    }

    // Elementos relacionados a cabos/fios (quantidade de rolos/metros, bitolas, cores, cabos)
    const isCableRelated = 
      lower.includes('cabo') || lower.includes('fio') || lower.includes('rolo') || 
      /\b\d+([.,]\d+)?\s*mm[²2]?\b/i.test(lower) || 
      lower.includes('cor azul') || lower.includes('cor preta') || lower.includes('cor vermelho') ||
      lower.includes('azul') || lower.includes('preto') || lower.includes('vermelho') || 
      lower.includes('verde') || lower.includes('amarelo') || lower.includes('branco');

    if (isCableRelated) {
      if (!pendingCable) {
        pendingCable = {};
      }

      // Quantidade de rolos ou metros
      const qtyMatch = norm.match(/\b(\d+\s*(rolos?|metros?|m))\b/i);
      if (qtyMatch) {
        pendingCable.quantity = qtyMatch[1];
      }

      // Bitola
      const gaugeMatch = norm.match(/(\d+([.,]\d+)?\s*mm[²2]?)/i);
      if (gaugeMatch) {
        pendingCable.gauge = gaugeMatch[1];
      }

      // Cor
      const colorMatch = norm.match(/\b(cor\s+)?(azul|preto|vermelho|verde|amarelo|branco|cinza)\b/i);
      if (colorMatch) {
        pendingCable.color = colorMatch[0].toLowerCase().startsWith('cor ') ? colorMatch[0] : `cor ${colorMatch[0]}`;
      }

      if (lower.includes('flexível') || lower.includes('flexivel')) {
        pendingCable.name = 'cabo flexível';
      }

      continue;
    }

    result.push(norm);
  }

  if (pendingCable) {
    result.push(formatCableItem(pendingCable));
  }

  return result.filter(Boolean);
}

/**
 * Constrói a lista real de materiais a partir das mensagens do usuário na conversa,
 * garantindo que apenas itens solicitados entrem na lista final e consolidando especificações.
 */
export function buildRealUserMaterialsList(messages: any[]): string[] {
  const userMessages = messages.filter((m: any) => m.role === 'user' || m.sender === 'user');
  
  const ignorePatterns = [
    /^(oi|ola|olá|bom dia|boa tarde|boa noite|como vai|tudo bem|opa|salve)[!?.]*$/i,
    /^(finalizar|concluir|fechar|pode fechar|pode finalizar|está pronta|esta pronta|pronto|pronta|gerar lista)[!?.]*$/i,
    /^(nao|não|apenas|só|so|isso|apenas isso|so isso|só isso|somente isso|não precisa|nao precisa|dispensa|nenhum|nada|nada mais)[!?., ]*$/i,
    /^(nao|não)[, ]+(apenas|só|so|isso|apenas isso|so isso|só isso|somente isso|nada mais)[!?., ]*$/i,
    /^(sim|pode ser|ok|beleza|blz|perfeito|otimo|ótimo|obrigado|obrigada|valeu)[!?.]*$/i,
    /^(quanto custa|qual o preço|qual o preco|quanto fica)[!?.]*$/i
  ];

  const nonMaterialWords = ['isso', 'apenas', 'so', 'só', 'nada', 'nenhum', 'tudo', 'ok', 'sim', 'nao', 'não', 'pronto', 'obrigado', 'valeu'];

  const candidateItems: string[] = [];

  for (const m of userMessages) {
    const rawText = String(m.text || m.content || '').trim();
    if (!rawText) continue;

    // Remove emojis gráficos reais no início (ex: 💡, 🔌, ⚡, 🏗️) sem remover números (como 3 rolos)
    let cleaned = rawText.replace(/^[\p{Extended_Pictographic}\s]+/u, '').trim();
    const lowerCleaned = cleaned.toLowerCase();

    // Se for comando de finalização ou mensagem de controle, descarta
    if (
      lowerCleaned.includes('finalizar') ||
      lowerCleaned.includes('fechar') ||
      lowerCleaned.includes('concluir') ||
      lowerCleaned.includes('só isso') ||
      lowerCleaned.includes('é isso') ||
      lowerCleaned.includes('está pronta') ||
      lowerCleaned.includes('esta pronta') ||
      ignorePatterns.some(pat => pat.test(lowerCleaned))
    ) {
      continue;
    }

    // Remove prefixos comuns ("nao, apenas", "preciso de", "quero", etc.)
    cleaned = cleaned
      .replace(/^(nao,\s*apenas|não,\s*apenas|nao\s+apenas|não\s+apenas|apenas|só|so)\s+/i, '')
      .replace(/^(preciso de|preciso|quero|vou precisar de|vou usar|coloque|adicione|adiciona|me vê|me ve|gostaria de|inclua|incluir)\s+/i, '')
      .trim();

    if (ignorePatterns.some(pat => pat.test(cleaned.toLowerCase()))) {
      continue;
    }

    if (nonMaterialWords.includes(cleaned.toLowerCase())) {
      continue;
    }

    if (cleaned.length > 2) {
      const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      if (!candidateItems.some(it => it.toLowerCase() === formatted.toLowerCase())) {
        candidateItems.push(formatted);
      }
    }
  }

  // Se estiver vazia, inspeciona menções reais no texto das mensagens do usuário
  if (candidateItems.length === 0) {
    const allUserText = userMessages.map((m: any) => String(m.text || m.content || '')).join(' ').toLowerCase();
    if (allUserText.includes('fita')) candidateItems.push('Fita isolante');
    if (allUserText.includes('led') || allUserText.includes('iluminação') || allUserText.includes('lâmpada')) candidateItems.push('Iluminação LED');
    if (allUserText.includes('cabo') || allUserText.includes('fio')) candidateItems.push('Cabos elétricos conforme especificação');
    if (allUserText.includes('disjuntor')) candidateItems.push('Disjuntores termomagnéticos');
    if (allUserText.includes('tomada') || allUserText.includes('interruptor')) candidateItems.push('Conjuntos de tomadas / interruptores');
  }

  const consolidated = consolidateMaterials(candidateItems);
  return consolidated.length > 0 ? consolidated : ['Materiais elétricos solicitados na conversa'];
}

/**
 * Extrai a lista limpa de materiais do texto retornado pelo assistente
 */
export function extractMaterialsList(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const materialLines: string[] = [];

  let isCollecting = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const lower = line.toLowerCase();

    // Detecta início comum de listas estruturadas ou confirmadas
    if (
      lower.includes('lista final') ||
      lower.includes('materiais:') ||
      lower.includes('itens:') ||
      lower.includes('relação:') ||
      lower.includes('lista confirmada') ||
      lower.includes('lista de materiais está finalizada') ||
      lower.includes('materiais finalizada') ||
      lower.includes('lista pronta') ||
      lower.includes('aqui está sua lista')
    ) {
      isCollecting = true;
      continue;
    }

    // Detecta frases de encerramento do atendente que marcam o final da lista
    if (
      lower.includes('nossa equipe do balcão') ||
      lower.includes('equipe calculará') ||
      lower.includes('posso encaminhar') ||
      lower.includes('estou à disposição') ||
      lower.includes('phoenix elétrica agradece') ||
      lower.includes('se precisar de algo mais') ||
      lower.includes('especialista apenas em materiais')
    ) {
      isCollecting = false;
      continue;
    }

    // Identifica itens de lista: bullet points, hífens, números, emojis
    const isBullet = /^[-*•·\d+.]\s+/i.test(line);

    // Identifica itens com características explícitas de produto elétrico
    const isElectricalItem = 
      lower.includes('cabo') || lower.includes('fio') || lower.includes('disjuntor') ||
      lower.includes('tomada') || lower.includes('interruptor') || lower.includes('fita') ||
      lower.includes('rolo') || lower.includes('metro') || lower.includes('iluminação') ||
      lower.includes('led') || lower.includes('eletroduto') || lower.includes('quadro') ||
      /\b\d+([.,]\d+)?\s*mm[²2]?\b/i.test(lower);

    if (isBullet || (isCollecting && isElectricalItem) || isElectricalItem) {
      const cleanItem = line.replace(/^[-*•·\d+.]\s*/, '').trim();
      if (cleanItem.length > 2 && !materialLines.includes(cleanItem)) {
        materialLines.push(cleanItem);
      }
    }
  }

  if (materialLines.length > 0) {
    return materialLines.join('\n');
  }

  // Fallback: se não formatou com bullets mas tem texto relevante, limpa pontuações de cabeçalho
  return text
    .replace(/^.*?(lista de materiais|itens sugeridos|aqui está|lista confirmada.*?:):?/is, '')
    .replace(/(A nossa equipe|O balcão|Posso encaminhar|A lista está pronta|A Phoenix Elétrica agradece).*$/is, '')
    .trim();
}

/**
 * Resposta inteligente local com os mesmos Guardrails estritos para garantir funcionamento
 * caso as chaves ainda não tenham sido inseridas no .env
 */
function generateFallbackResponse(userPrompt: string, history: ChatMessage[]): string {
  const lower = userPrompt.toLowerCase().trim();

  // 1. Saudações naturais e educadas
  const isGreeting = 
    /^(oi|ola|olá|opa|bom dia|boa tarde|boa noite|como vai|tudo bem|e ai|e aí|salve|fala|oie)(\s+(como vai|tudo bem|amigo|phoenix|boa tarde|bom dia|boa noite))?[!?.]*$/i.test(lower) ||
    lower === 'oi como vai' || 
    lower === 'ola tudo bem' || 
    lower === 'olá tudo bem' || 
    lower === 'tudo bem?' || 
    lower === 'tudo bem' ||
    lower === 'oi como voce esta' ||
    lower === 'oi, tudo bem?';

  if (isGreeting) {
    return 'Olá! Tudo bem? Sou o assistente técnico de vendas da Phoenix Elétrica, em São Paulo. Me diga que tipo de obra ou reforma você vai fazer (ou quais materiais elétricos você já sabe que precisa) e eu te ajudo a estruturar uma lista completa para orçamento!';
  }

  // 2. Agradecimentos comuns
  const isThanks = /^(obrigado|obrigada|valeu|muito obrigado|agradeço|show|beleza|blz|perfeito|otimo|ótimo)[!?.]*$/i.test(lower);
  if (isThanks) {
    return 'À disposição! Se precisar adicionar mais algum material elétrico ou conferir a relação antes de falar com nosso balcão, estou por aqui.';
  }

  // 3. Guardrail 1: Pergunta de preço ou prazo
  if (
    lower.includes('preço') || 
    lower.includes('quanto custa') || 
    lower.includes('valor') || 
    lower.includes('desconto') || 
    lower.includes('prazo') ||
    lower.includes('entrega em quanto tempo') ||
    lower.includes('quanto fica')
  ) {
    return 'Nossos preços, descontos e prazos de entrega são calculados diretamente pelo balcão técnico da Phoenix Elétrica. Vamos finalizar os materiais necessários da sua lista primeiro?';
  }

  // 4. Finalização da lista (Guardrail 5)
  if (
    lower.includes('finalizar') || 
    lower.includes('só isso') || 
    lower.includes('é isso') || 
    lower.includes('concluir') || 
    lower.includes('está pronta') ||
    lower.includes('pode fechar') ||
    lower === 'pronto' ||
    lower === 'pode gerar'
  ) {
    const fullConversation = history.concat([{ id: 'temp-last', sender: 'user', text: userPrompt, timestamp: new Date() }]);
    const realItems = buildRealUserMaterialsList(fullConversation);
    const bullets = realItems.map(item => `• ${item}`).join('\n');

    return `Perfeito! Aqui está a sua lista final estruturada para o orçamento:\n\n${bullets}\n\nA lista está pronta para envio! Basta clicar em "Usar esta Lista no Orçamento" para enviar direto ao WhatsApp da Phoenix Elétrica.`;
  }

  // Termos do universo elétrico e de obras
  const electricalTerms = [
    'cabo', 'fio', 'disjuntor', 'tomada', 'interruptor', 'led', 'lâmpada', 'lampada', 'refletor',
    'eletroduto', 'corrugado', 'fita', 'isolante', 'quadro', 'distribuição', 'distribuicao', 'trifásico',
    'bifásico', 'monofásico', 'dr', 'dps', 'barramento', 'canaleta', 'perfilado',
    'eletrocalha', 'reator', 'contator', 'relé', 'rele', 'borne', 'conector', 'wago', 'obra',
    'instalação', 'instalacao', 'elétrica', 'eletrica', 'reforma', 'energia', 'volts', 'amperes', '110v', '220v',
    'dimmer', 'sensor', 'fotocélula', 'fotocelula', 'plafon', 'spot', 'soquete', 'chuveiro', 'lista',
    'orçamento', 'orcamento', 'materiais', 'fiação', 'fiacao', 'iluminação', 'iluminacao', 'poste', 'padrão',
    'neutro', 'terra', 'fase', 'conduíte', 'conduite', 'caixinha', '4x2', '4x4', 'eletricidade', 'tubulação', 'curva', 'luva'
  ];

  // Unidades de medidas e quantidades usadas em materiais elétricos
  const measurementAndQuantityTerms = [
    'rolo', 'rolos', 'metro', 'metros', 'm', 'mm', 'mm²', 'peça', 'peças', 'peca', 'pecas',
    'unidade', 'unidades', 'un', 'barra', 'barras', 'caixa', 'caixas', 'pacote', 'pacotes',
    'cento', 'kit', 'kits', 'bobina', 'bobinas', 'par', 'pares', 'circuito', 'circuitos'
  ];

  // Respostas conversacionais a perguntas anteriores (sim, não, apenas, etc.)
  const conversationalAnswerPatterns = [
    'sim', 'nao', 'não', 'apenas', 'so', 'só', 'somente', 'pode ser', 'não precisa', 'nao precisa',
    'dispensa', 'quero', 'vou querer', 'prefiro', 'coloque', 'adicione', 'inclua', 'pode colocar',
    'pode incluir', 'só isso', 'apenas isso', 'já tenho', 'ja tenho', 'de 100', 'de 50', 'de 25'
  ];

  // Atributos e especificações técnicas de materiais elétricos
  const electricalAttributes = [
    'azul', 'vermelho', 'preto', 'verde', 'amarelo', 'branco', 'cinza',
    'monopolar', 'bipolar', 'tripolar', 'tetrapolar', 'din', 'nema',
    '10a', '16a', '20a', '25a', '32a', '40a', '50a', '63a', '70a', '80a', '100a',
    '110v', '127v', '220v', '380v', 'bivolt', 'monofasico', 'bifasico', 'trifasico',
    'monofásico', 'bifásico', 'trifásico', '1,5', '2,5', '1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120'
  ];

  const hasElectricalTopic = electricalTerms.some((term) => lower.includes(term));
  const hasQuantityOrUnit = measurementAndQuantityTerms.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(lower));
  const hasConversationalAnswer = conversationalAnswerPatterns.some((term) => lower.includes(term));
  const hasElectricalAttribute = electricalAttributes.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(lower));
  const hasNumbers = /\d+/.test(lower);

  // Verifica se o histórico anterior já estava tratando de materiais elétricos
  const previousHistoryText = history
    .map((m) => m.text)
    .join(' ')
    .toLowerCase();
  const hadElectricalContext = electricalTerms.some((term) => previousHistoryText.includes(term));

  // Continuação contextual de conversa sobre materiais elétricos
  const isContextualElectricalReply = 
    hadElectricalContext && 
    (hasQuantityOrUnit || hasConversationalAnswer || hasElectricalAttribute || hasNumbers);

  // 5. Guardrail 2: Se o assunto não for material elétrico/obras, responda EXATAMENTE
  if (!hasElectricalTopic && !isContextualElectricalReply) {
    return 'Sou especialista apenas em materiais elétricos. Como posso ajudar com a sua lista?';
  }

  // 6. Tratamento de respostas contextuais de quantidades e especificações (ex: "nao apenas 3 rolos, de 100 m" ou "15.mm2 core azul")
  if (isContextualElectricalReply && !hasElectricalTopic) {
    if (lower.includes('rolo') || lower.includes('metro') || lower.includes('100') || lower.includes('50') || lower.includes('cabo')) {
      const cleanQty = userPrompt
        .replace(/^(preciso de|quero|me vê|vou usar|adicione|adicionar)\s+/i, '')
        .replace(/^(nao,\s*apenas|não,\s*apenas|apenas|só|so)\s+/i, '')
        .trim();
      const hasNegation = lower.includes('nao') || lower.includes('não') || lower.includes('apenas') || lower.includes('dispensa');
      const negationNote = hasNegation ? ' (sem os itens complementares)' : '';
      return `Entendido! Anotei a quantidade: ${cleanQty} de cabo flexível${negationNote}. Quais bitolas ou cores você vai precisar para esses cabos (ex: 1,5mm² ou 2,5mm² nas cores azul, preto ou vermelho)? Se já estiver tudo definido, posso fechar a lista para o orçamento!`;
    }

    if (hasElectricalAttribute) {
      const normSpec = normalizeSpec(userPrompt);
      const allPrevText = history.map(m => m.text).join(' ').toLowerCase();
      const prevQtyMatch = allPrevText.match(/\b(\d+\s*rolos?)\b/i);
      const qtyPrefix = prevQtyMatch ? `${prevQtyMatch[1]} de cabo flexível ` : '';

      return `Perfeito! Atualizei sua lista com: ${qtyPrefix}${normSpec}. Deseja adicionar mais algum material elétrico à sua relação ou podemos finalizar e gerar a lista para o balcão?`;
    }

    if (lower.includes('nao') || lower.includes('não') || lower.includes('apenas') || lower.includes('dispensa')) {
      return `Entendido, mantemos apenas os itens que você solicitou, sem os adicionais. Mais algum material elétrico que deseja incluir ou podemos finalizar a lista para o orçamento?`;
    }

    if (lower.includes('sim') || lower.includes('pode') || lower.includes('quero') || lower.includes('adicione')) {
      return `Excelente! Incluí os itens complementares de instalação na sua relação. Quantas peças ou metros estima para cada um? Se preferir, já podemos estruturar a lista para o balcão!`;
    }

    return `Anotado: ${userPrompt.trim()}. Deseja incluir mais algum item ou podemos fechar a sua lista de materiais elétricos para o balcão da Phoenix Elétrica?`;
  }

  // 7. Intenção de Reforma / Instalação Residencial ou Predial
  if (
    lower.includes('reforma') || 
    lower.includes('reformar') || 
    lower.includes('fiação') || 
    lower.includes('fiacao') || 
    lower.includes('afiação') || 
    lower.includes('afiacao') || 
    lower.includes('casa') || 
    lower.includes('apartamento') || 
    lower.includes('residencial')
  ) {
    return `Excelente! Para a reforma ou troca de fiação de uma casa com total segurança e conforme as normas da NBR 5410, estruturei esta relação básica de materiais essenciais:\n\n` +
      `• Cabos flexíveis 750V 1,5mm² (iluminação - cores azul, vermelho/preto e verde)\n` +
      `• Cabos flexíveis 750V 2,5mm² (tomadas de uso geral TUGs - azul, vermelho e verde)\n` +
      `• Cabos flexíveis 750V 4mm² ou 6mm² (circuito independente de chuveiro elétrico e ar-condicionado)\n` +
      `• Quadro de distribuição de embutir (com barramento de cobre tipo pente)\n` +
      `• Disjuntor geral bipolar/tripolar e mini disjuntores DIN Curva C (10A, 16A, 20A e 32A)\n` +
      `• Dispositivo DR (IDR 30mA) para proteção obrigatória contra choques elétricos\n` +
      `• Protetor de Surtos DPS Classe II para proteger eletrodomésticos contra descargas atmosféricas\n` +
      `• Eletrodutos corrugados reforçados 25mm e 32mm para passagem dos condutores\n` +
      `• Caixas de embutir 4x2 e 4x4 e conjuntos de tomadas 10A e 20A com placas\n` +
      `• Fita isolante 3M antichama, passa-fio e conectores de emenda rápida\n\n` +
      `Quantos cômodos tem a sua casa ou qual a metragem aproximada para estimarmos as quantidades de rolos? Se preferir, você já pode clicar em "Usar Esta Lista no Orçamento" para cotar estes itens no balcão!`;
  }

  // 8. Sugestões inteligentes complementares (Guardrail 3 e 4)
  if (lower.includes('cabo') || lower.includes('fio')) {
    if (hasNumbers || hasQuantityOrUnit) {
      return `Perfeito! Anotei: ${userPrompt.trim()}. Para a instalação desses cabos, você também vai precisar de fita isolante 3M, passa-fio, conectores de emenda (tipo Wago) e eletrodutos corrugados? Quais cores ou bitolas deseja especificar?`;
    }
    return 'Entendido. Para a passagem dos cabos, você também vai precisar de fita isolante 3M, passa-fio, conectores de emenda (tipo Wago) e eletrodutos corrugados? Quantos metros ou rolos estima para cada circuito?';
  }

  if (lower.includes('disjuntor') || lower.includes('quadro')) {
    return 'Certo. Para o quadro de distribuição, recomendo incluir: Disjuntor Geral, Disjuntores parciais para circuitos, Dispositivo DR (diferencial residual contra choques), DPS contra surtos e barramento de cobre tipo pente. Deseja adicionar barramento e DR?';
  }

  if (lower.includes('iluminação') || lower.includes('led') || lower.includes('refletor') || lower.includes('spot')) {
    return 'Ótimo. Para os pontos de iluminação, além das luminárias/refletores LED, vai precisar de sensores de presença, relés fotocélula, fita isolante e soquetes ou conectores rápidos? Deseja branco frio (6500K) ou branco quente (3000K)?';
  }

  if (lower.includes('tomada') || lower.includes('interruptor')) {
    return 'Perfeito. Para as tomadas e interruptores, vai precisar de conjuntos modulares 10A e 20A (para micro-ondas e chuveiro), além das caixas de embutir 4x2 e 4x4 amarelas reforçadas. Quantas unidades de cada?';
  }

  // Resposta padrão comercial para materiais elétricos
  return `Excelente. Anotei sua solicitação. Para complementar a sua instalação com segurança, recomendo adicionarmos fita isolante 3M e conectores adequados. Mais algum item de infraestrutura ou cabeamento que deseja incluir na lista antes de enviarmos ao balcão?`;
}

/**
 * Envia histórico de mensagens para a IA com os Guardrails estritos
 */
export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const lastUserMessage = messages[messages.length - 1]?.text || '';

  // 1. Tenta API Gemini direta se configurada no frontend (VITE_GEMINI_API_KEY)
  const viteGeminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (viteGeminiKey && viteGeminiKey.trim() !== '') {
    try {
      const ai = new GoogleGenAI({ apiKey: viteGeminiKey });
      
      const contents = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: PHOENIX_SYSTEM_PROMPT,
          temperature: 0.2,
        }
      });

      if (response.text) {
        return response.text.trim();
      }
    } catch (err) {
      console.warn('Falha na chamada Gemini direta pelo cliente, tentando servidor:', err);
    }
  }

  // 2. Tenta API OpenAI direta se configurada no frontend (VITE_OPENAI_API_KEY)
  const viteOpenAiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (viteOpenAiKey && viteOpenAiKey.trim() !== '') {
    try {
      const openAiMessages = [
        { role: 'system', content: PHOENIX_SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }))
      ];

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${viteOpenAiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openAiMessages,
          temperature: 0.2,
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return text.trim();
      }
    } catch (err) {
      console.warn('Falha na chamada OpenAI direta pelo cliente, tentando servidor:', err);
    }
  }

  // 3. Tenta a rota segura do servidor (/api/chat-assistant)
  try {
    const res = await fetch('/api/chat-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.sender,
          text: m.text
        }))
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        return data.text.trim();
      }
    }
  } catch (serverErr) {
    console.warn('Rota /api/chat-assistant não respondeu:', serverErr);
  }

  // 4. Fallback com Guardrails rigorosamente idênticos para não quebrar a experiência do usuário
  return generateFallbackResponse(lastUserMessage, messages.slice(0, -1));
}
