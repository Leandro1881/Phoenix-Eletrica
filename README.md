# Phoenix Elétrica

Site da **Phoenix Elétrica**, distribuidora de materiais elétricos no Bom Retiro, São Paulo.
No ar em **[phoenixel.com.br](https://phoenixel.com.br)**.

O site apresenta as categorias de produtos, recebe pedidos de orçamento (com anexo de lista em PDF, planilha ou foto), leva o cliente ao WhatsApp da loja e tem um assistente de IA que monta a lista de materiais junto com o cliente.

## Funcionalidades

- **Assistente de orçamento com IA.** O cliente descreve o que precisa ("3 rolos de cabo 2,5mm²" ou "reforma de um apartamento"). O assistente pergunta o que falta (medida, quantidade, cor), monta uma lista organizada e pede confirmação. Depois do OK, a lista vai para o formulário de orçamento. Ele não informa preço, estoque nem prazo: isso fica com o balcão da loja.
- **Formulário de orçamento** com anexo de arquivos e captcha (Cloudflare Turnstile).
- **Páginas por categoria** (fios e cabos, disjuntores e quadros, iluminação LED, infraestrutura, tomadas e interruptores, automação e comandos), cada uma com endereço, título e descrição próprios.
- **Avaliações reais do Google** da loja, pela Google Places API.
- **Painel do lojista** em endereço secreto, com login, 2FA (TOTP), códigos de recuperação e um dashboard de orçamentos, visitas e cliques no WhatsApp.
- **SEO técnico**: dados estruturados (Schema.org `HardwareStore` e `WebSite`), sitemap, canonical, Open Graph e `llms.txt`.

## Tecnologias

| Parte | Tecnologia |
| --- | --- |
| Front-end | React 19, Vite, Tailwind CSS v4, Motion, lucide-react |
| Servidor | Node.js com Express (`server.ts`, executado com `tsx`) |
| Banco de dados | SQLite via sql.js, gravado em arquivo |
| IA | Google Gemini (`@google/genai`), com resposta em JSON estruturado; OpenAI como alternativa opcional |
| Arquivos | Google Cloud Storage para os anexos das cotações |
| Hospedagem | Google Cloud Run (container Docker), com o banco em um bucket montado como disco |

### Como o assistente funciona

O código do agente fica em [`src/ai/quoteAgent.ts`](src/ai/quoteAgent.ts) e a tela em [`src/components/AiQuoteAssistant.tsx`](src/components/AiQuoteAssistant.tsx).

1. O navegador envia a conversa, a lista atual e a etapa (`coletando`, `aguardando_confirmacao` ou `confirmado`) para `POST /api/chat-assistant`.
2. O servidor chama o Gemini com instruções fixas do agente e pede uma resposta em JSON: o texto da resposta, a etapa e a lista de itens (produto, especificação e quantidade).
3. Se um modelo falhar ou demorar, o servidor tenta o próximo. Sem nenhuma IA disponível, um modo simples anota o que o cliente escreveu.
4. Quando o cliente confirma, o servidor responde sozinho, sem chamar a IA, e o site coloca os itens novos no formulário.

Não há RAG nem orquestrador (LangChain, n8n): o conhecimento vem das instruções do agente. A chave da IA fica só no servidor. Há limite de mensagens por pessoa e por dia, e o histórico enviado à IA é cortado para controlar o custo.

## Rodar localmente

Requisitos: Node.js 22 (a mesma versão do Dockerfile).

```bash
npm install
cp .env.example .env   # preencha ao menos GEMINI_API_KEY
npm run build
npm start              # http://localhost:3000
```

Sem `ADMIN_PATH`, o painel local fica em `/painel-local-dev`. As variáveis estão explicadas em [`.env.example`](.env.example).

## Deploy

O `Dockerfile` gera a imagem, publicada no Artifact Registry e executada no Cloud Run:

```bash
gcloud builds submit --tag <região>-docker.pkg.dev/<projeto>/<repositório>/phoenix-site:<versão>
gcloud run deploy phoenix-site --image <região>-docker.pkg.dev/<projeto>/<repositório>/phoenix-site:<versão>
```

As chaves e segredos ficam nas variáveis de ambiente do serviço, nunca no código.
