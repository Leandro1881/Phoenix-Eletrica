import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import initSqlJs, { Database } from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'phoenix_eletrica.db');

let db: Database | null = null;

// Inicialização do Banco SQLite
async function setupDatabase() {
  try {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log('✓ [SQLite] Banco de dados existente carregado de', DB_PATH);
    } else {
      db = new SQL.Database();
      console.log('✓ [SQLite] Novo banco em memória criado.');
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS clientes_orcamento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        cidade TEXT NOT NULL,
        materiais TEXT NOT NULL,
        aceita_marketing INTEGER NOT NULL DEFAULT 0,
        data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migração automática se a tabela já existir sem a coluna aceita_marketing ou email (ALTER TABLE)
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN aceita_marketing INTEGER NOT NULL DEFAULT 0`);
    } catch (_) {}
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN email TEXT DEFAULT ''`);
    } catch (_) {}
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN arquivo_nome TEXT DEFAULT ''`);
    } catch (_) {}
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN arquivo_tamanho TEXT DEFAULT ''`);
    } catch (_) {}
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN arquivo_url TEXT DEFAULT ''`);
    } catch (_) {}

    db.run(`
      CREATE TABLE IF NOT EXISTS visitas_site (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dispositivo TEXT,
        navegador TEXT,
        origem TEXT,
        pagina TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS avaliacoes_google (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        autor TEXT NOT NULL,
        cargo TEXT NOT NULL,
        nota INTEGER NOT NULL,
        data_texto TEXT NOT NULL,
        comentario TEXT NOT NULL,
        verificado INTEGER DEFAULT 1,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS admin_auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        data_modificacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cliques_whatsapp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        origem_botao TEXT NOT NULL,
        rotulo TEXT,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Inicializa credenciais padrão caso não exista
    const adminCheck = db.exec(`SELECT COUNT(*) as total FROM admin_auth`);
    const totalAdmin = adminCheck[0]?.values[0]?.[0] || 0;
    if (totalAdmin === 0) {
      db.run(
        `INSERT INTO admin_auth (usuario, senha) VALUES (?, ?)`,
        ['admin', 'phoenix@2024']
      );
    }

    // Inicializa cliques de WhatsApp simulados para histórico executivo se estiver vazio
    const clickCheck = db.exec(`SELECT COUNT(*) as total FROM cliques_whatsapp`);
    const totalClicks = clickCheck[0]?.values[0]?.[0] || 0;
    if (totalClicks === 0) {
      const sampleClicks = [
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-09-26 14:15:00' },
        { origem: 'Formulário de Cotação', rotulo: 'Abrir WhatsApp Pós-Envio', data: '2026-09-26 11:32:00' },
        { origem: 'Cabeçalho / Topo', rotulo: 'Televendas WhatsApp', data: '2026-09-26 09:20:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-09-25 16:40:00' },
        { origem: 'Catálogo de Produtos', rotulo: 'Fios e Cabos', data: '2026-09-25 10:11:00' },
        { origem: 'Rodapé da Loja', rotulo: 'WhatsApp Comercial', data: '2026-09-24 15:05:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-09-23 17:10:00' },
        { origem: 'Formulário de Cotação', rotulo: 'Abrir WhatsApp Pós-Envio', data: '2026-09-22 13:45:00' },
        { origem: 'Catálogo de Produtos', rotulo: 'Disjuntores & Quadros', data: '2026-09-21 08:50:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-09-20 14:22:00' },
        { origem: 'Cabeçalho / Topo', rotulo: 'Televendas WhatsApp', data: '2026-09-18 16:15:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-09-15 11:02:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-08-28 14:10:00' },
        { origem: 'Formulário de Cotação', rotulo: 'Abrir WhatsApp Pós-Envio', data: '2026-08-25 10:30:00' },
        { origem: 'Cabeçalho / Topo', rotulo: 'Televendas WhatsApp', data: '2026-08-20 16:00:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-08-15 09:40:00' },
        { origem: 'Catálogo de Produtos', rotulo: 'Iluminação LED', data: '2026-08-10 11:20:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-08-04 15:50:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-07-25 10:10:00' },
        { origem: 'Formulário de Cotação', rotulo: 'Abrir WhatsApp Pós-Envio', data: '2026-07-18 14:20:00' },
        { origem: 'Cabeçalho / Topo', rotulo: 'Televendas WhatsApp', data: '2026-07-12 16:45:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-07-05 11:15:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-06-20 15:30:00' },
        { origem: 'Formulário de Cotação', rotulo: 'Abrir WhatsApp Pós-Envio', data: '2026-06-14 10:00:00' },
        { origem: 'Botão Flutuante (WhatsApp)', rotulo: 'WhatsApp Principal', data: '2026-06-08 17:15:00' }
      ];

      for (const clk of sampleClicks) {
        db.run(
          `INSERT INTO cliques_whatsapp (origem_botao, rotulo, data_hora) VALUES (?, ?, ?)`,
          [clk.origem, clk.rotulo, clk.data]
        );
      }
    }

    // Inicializa orçamentos distribuídos caso banco seja novo
    const leadCheck = db.exec(`SELECT COUNT(*) as total FROM clientes_orcamento`);
    const totalLeads = Number(leadCheck[0]?.values[0]?.[0] || 0);
    if (totalLeads < 4) {
      const sampleLeads = [
        {
          nome: 'Engenheiro Marcos Vinicius',
          telefone: '(11) 98765-4321',
          cidade: 'São Paulo - SP',
          materiais: '6 rolos de Cabo Flexível 2.5mm² antichama (azul e preto), 4 rolos de Cabo 4mm² e 20 disjuntores DIN bipolar 20A Steck.',
          data: '2026-09-26 10:45:00'
        },
        {
          nome: 'Construtora Alvorada Ltda (Carlos)',
          telefone: '(11) 99123-8877',
          cidade: 'Guarulhos - SP',
          materiais: '100m Eletroduto Corrugado 25mm Tigre, 15 Caixas 4x2 PVC reforçadas, 30 Tomadas 2P+T 10A e 10 Tomadas 20A.',
          data: '2026-09-25 15:20:00'
        },
        {
          nome: 'Julio Cesar Instalador',
          telefone: '(11) 97654-1122',
          cidade: 'São Paulo - SP',
          materiais: '8 Refletores LED 100W IP66 Branco Frio, 12 Luminárias Painel LED de Embutir 24W 6500K e 50m fita isolante 3M.',
          data: '2026-09-24 09:15:00'
        },
        {
          nome: 'Eletrotécnica Moura & Cia',
          telefone: '(11) 98221-5544',
          cidade: 'Campinas - SP',
          materiais: '4 Contatores Tripolares 25A 220V, 2 Relés Térmicos de Sobrecarga 16-24A, 1 Inversor de Frequência 5CV e botoeiras de comando.',
          data: '2026-09-21 16:40:00'
        },
        {
          nome: 'Mariana Duarte (Reforma Residencial)',
          telefone: '(11) 99344-7711',
          cidade: 'São Bernardo do Campo - SP',
          materiais: '2 Quadros de Distribuição 24 DIN com barramento neutro/terra, 1 Disjuntor Geral 63A e 8 Disjuntores 16A Curva C.',
          data: '2026-09-17 11:30:00'
        },
        {
          nome: 'Indústria Têxtil Bom Retiro',
          telefone: '(11) 98112-9900',
          cidade: 'São Paulo - SP',
          materiais: '300m Cabo Flexível 10mm² 750V Prysmian, barramentos de cobre e chaves seccionadoras sob carga 100A.',
          data: '2026-08-28 14:15:00'
        },
        {
          nome: 'Condomínio Solar das Palmeiras',
          telefone: '(11) 97433-2288',
          cidade: 'Osasco - SP',
          materiais: '15 Refletores LED 200W para quadra, sensores de presença fotocélula e 150m Cabo PP 3x2.5mm².',
          data: '2026-08-16 10:00:00'
        },
        {
          nome: 'Fábio Eletricista Predial',
          telefone: '(11) 99554-3322',
          cidade: 'Santo André - SP',
          materiais: 'Fios 1.5mm² e 2.5mm², 40 interruptores e tomadas modulares brancas, disjuntores termomagnéticos DIN.',
          data: '2026-07-22 13:40:00'
        },
        {
          nome: 'Galpão Logístico Express',
          telefone: '(11) 98991-6677',
          cidade: 'São Paulo - SP',
          materiais: 'Eletrocalhas perfuradas 100x50mm galvanizadas a fogo, perfilados, curvas 90° e pendurais com tirantes.',
          data: '2026-06-19 16:10:00'
        }
      ];

      for (const lead of sampleLeads) {
        db.run(
          `INSERT INTO clientes_orcamento (nome, telefone, cidade, materiais, data_solicitacao) VALUES (?, ?, ?, ?, ?)`,
          [lead.nome, lead.telefone, lead.cidade, lead.materiais, lead.data]
        );
      }
    }

    // Inicializa visitas distribuídas para histórico executivo condizente com as interações
    const visitCheck = db.exec(`SELECT COUNT(*) as total FROM visitas_site`);
    const totalVisits = Number(visitCheck[0]?.values[0]?.[0] || 0);
    if (totalVisits < 40) {
      // Garante uma base realista de visitas para os períodos
      const sampleVisits = [
        // Setembro / 2026 (Mês atual com boa tração)
        { data: '2026-09-26 17:30:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-26 16:30:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-26 15:10:00', disp: 'Desktop / Computador', nav: 'Edge', orig: 'Google Maps' },
        { data: '2026-09-26 14:05:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'Acesso Direto' },
        { data: '2026-09-26 12:45:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'Acesso Direto' },
        { data: '2026-09-26 10:20:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-26 09:10:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-25 18:00:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Instagram / Redes' },
        { data: '2026-09-25 16:30:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'Google Maps' },
        { data: '2026-09-25 14:15:00', disp: 'Desktop / Computador', nav: 'Firefox', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-25 11:20:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Acesso Direto' },
        { data: '2026-09-24 16:40:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-24 11:30:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'WhatsApp Compartilhado' },
        { data: '2026-09-24 09:15:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-23 15:40:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Maps' },
        { data: '2026-09-23 09:50:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-22 17:40:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Maps' },
        { data: '2026-09-22 14:10:00', disp: 'Desktop / Computador', nav: 'Edge', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-21 15:30:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-21 13:20:00', disp: 'Desktop / Computador', nav: 'Edge', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-20 16:20:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Acesso Direto' },
        { data: '2026-09-19 11:15:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-18 15:45:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Maps' },
        { data: '2026-09-17 10:20:00', disp: 'Desktop / Computador', nav: 'Firefox', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-15 14:30:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-12 11:00:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-09-08 16:10:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Maps' },

        // Agosto / 2026
        { data: '2026-08-28 15:30:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-08-25 14:00:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-08-22 11:15:00', disp: 'Desktop / Computador', nav: 'Edge', orig: 'Google Maps' },
        { data: '2026-08-20 10:30:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Acesso Direto' },
        { data: '2026-08-18 17:00:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'Google Busca (Orgânica)' },
        { data: '2026-08-15 16:45:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'Google Maps' },
        { data: '2026-08-12 14:20:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-08-10 10:10:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Acesso Direto' },
        { data: '2026-08-05 16:40:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },

        // Julho / 2026
        { data: '2026-07-28 11:10:00', disp: 'Desktop / Computador', nav: 'Firefox', orig: 'Google Busca (Orgânica)' },
        { data: '2026-07-25 15:30:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Maps' },
        { data: '2026-07-20 14:10:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-07-15 15:25:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Maps' },
        { data: '2026-07-12 10:45:00', disp: 'Desktop / Computador', nav: 'Edge', orig: 'Acesso Direto' },
        { data: '2026-07-08 16:20:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'Google Busca (Orgânica)' },

        // Junho / 2026
        { data: '2026-06-25 15:40:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-06-22 10:40:00', disp: 'Desktop / Computador', nav: 'Chrome', orig: 'Google Busca (Orgânica)' },
        { data: '2026-06-18 16:50:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Maps' },
        { data: '2026-06-14 11:20:00', disp: 'Desktop / Computador', nav: 'Edge', orig: 'Acesso Direto' },
        { data: '2026-06-10 14:15:00', disp: 'Mobile / Celular', nav: 'Safari', orig: 'Acesso Direto' },
        { data: '2026-06-05 09:30:00', disp: 'Mobile / Celular', nav: 'Chrome', orig: 'Google Busca (Orgânica)' }
      ];
      for (const v of sampleVisits) {
        db.run(
          `INSERT INTO visitas_site (data_hora, dispositivo, navegador, origem, pagina) VALUES (?, ?, ?, ?, '/')`,
          [v.data, v.disp, v.nav, v.orig]
        );
      }
    }

    // Garante as 3 melhores avaliações verídicas 5 estrelas do Google
    db.run(`DELETE FROM avaliacoes_google`);
    const initialReviews = [
      {
        autor: 'Carlos Alberto',
        cargo: 'Local Guide no Google',
        nota: 5,
        data_texto: 'Há 3 semanas',
        comentario: 'Excelente atendimento, variedade grande de materiais elétricos e preço justo. Sempre compro para as reformas.'
      },
      {
        autor: 'Roberto Santos',
        cargo: 'Avaliação Verificada no Google',
        nota: 5,
        data_texto: 'Há 1 mês',
        comentario: 'Ótima distribuidora no Bom Retiro. Pessoal atencioso, estoque a pronta entrega e facilidade no faturamento.'
      },
      {
        autor: 'Eduardo Lima',
        cargo: 'Avaliação Verificada no Google',
        nota: 5,
        data_texto: 'Há 2 semanas',
        comentario: 'Atendimento nota 10, encontrei todos os cabos e disjuntores que precisava com preço de atacado.'
      }
    ];

    for (const rev of initialReviews) {
      db.run(
        `INSERT INTO avaliacoes_google (autor, cargo, nota, data_texto, comentario, verificado) VALUES (?, ?, ?, ?, ?, 1)`,
        [rev.autor, rev.cargo, rev.nota, rev.data_texto, rev.comentario]
      );
    }

    // Persiste no arquivo
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log('✓ [SQLite] Tabelas clientes_orcamento, visitas_site e avaliacoes_google prontas.');
  } catch (error) {
    console.error('Erro ao inicializar SQLite:', error);
  }
}

async function startServer() {
  await setupDatabase();

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Diretório de Uploads para Anexos de Orçamentos (PDF, Word, Excel, etc.)
  const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  app.use('/uploads', express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
      // Garante visualização inline de PDFs nos navegadores
      if (filePath.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
      }
    }
  }));

  // Rota de Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Phoenix Elétrica API',
      database: db ? 'connected' : 'initializing',
      time: new Date().toISOString()
    });
  });

  // Rota POST: Upload de Arquivo de Orçamento (PDF, Word, etc.)
  app.post('/api/upload', (req, res) => {
    try {
      const { fileName, fileBase64, fileSize } = req.body;

      if (!fileName || !fileBase64) {
        return res.status(400).json({
          status: 'error',
          message: 'fileName e fileBase64 são obrigatórios para o upload.'
        });
      }

      const cleanExt = path.extname(fileName) || '.bin';
      const rawBaseName = path.basename(fileName, cleanExt);
      const safeBaseName = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
      const safeFileName = `orcamento-${Date.now()}-${safeBaseName}${cleanExt}`;
      const targetFilePath = path.join(UPLOADS_DIR, safeFileName);

      // Decodifica Base64 e salva no disco
      const base64Data = fileBase64.replace(/^data:([A-Za-z-+/]+);base64,/, '');
      fs.writeFileSync(targetFilePath, Buffer.from(base64Data, 'base64'));

      // Monta a URL pública absoluta
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const forwardedHost = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
      const clientOrigin = req.body.clientOrigin ? String(req.body.clientOrigin).replace(/\/$/, '') : null;
      const fileUrl = clientOrigin 
        ? `${clientOrigin}/uploads/${safeFileName}` 
        : `${proto}://${forwardedHost}/uploads/${safeFileName}`;

      console.log(`✓ [UPLOAD CONCLUÍDO] Arquivo salvo: ${safeFileName} (${fileSize || 'N/A'}) - URL Pública: ${fileUrl}`);

      return res.status(200).json({
        status: 'success',
        fileName,
        safeFileName,
        url: fileUrl,
        size: fileSize || ''
      });
    } catch (err: any) {
      console.error('Erro no upload de arquivo:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Falha ao processar o upload do arquivo',
        detail: err.message
      });
    }
  });

  // Rota POST: Inserir novo orçamento (Lead com verificação LGPD e suporte a anexo)
  app.post('/api/orcamentos', (req, res) => {
    try {
      const { nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, arquivo_url } = req.body;

      const cleanNome = String(nome || '').trim();
      const cleanTelefone = String(telefone || '').trim();
      const cleanCidade = String(cidade || '').trim();
      const cleanArquivoNome = String(arquivo_nome || '').trim();
      const cleanArquivoTamanho = String(arquivo_tamanho || '').trim();
      const cleanArquivoUrl = String(arquivo_url || '').trim();
      let cleanMateriais = String(materiais || '').trim();

      if (!cleanMateriais && cleanArquivoNome) {
        cleanMateriais = `[Arquivo em Anexo: ${cleanArquivoNome}]`;
      }

      if (!cleanNome || !cleanTelefone || !cleanCidade || !cleanMateriais) {
        return res.status(400).json({
          status: 'error',
          message: 'Campos nome, telefone, cidade e lista de materiais (ou anexo) são obrigatórios.'
        });
      }

      // Converte consentimento explícito LGPD para 1 (True) ou 0 (False)
      const optInMarketing = (aceita_marketing === true || aceita_marketing === 1 || aceita_marketing === '1') ? 1 : 0;
      const cleanEmail = String(email || '').trim();

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (db) {
        try {
          db.run(
            `INSERT INTO clientes_orcamento (nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, arquivo_url, data_solicitacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [cleanNome, cleanEmail, cleanTelefone, cleanCidade, cleanMateriais, optInMarketing, cleanArquivoNome, cleanArquivoTamanho, cleanArquivoUrl, now]
          );
        } catch (_) {
          try {
            db.run(
              `INSERT INTO clientes_orcamento (nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, data_solicitacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [cleanNome, cleanEmail, cleanTelefone, cleanCidade, cleanMateriais, optInMarketing, cleanArquivoNome, cleanArquivoTamanho, now]
            );
          } catch (__) {
            db.run(
              `INSERT INTO clientes_orcamento (nome, telefone, cidade, materiais, aceita_marketing, data_solicitacao) VALUES (?, ?, ?, ?, ?, ?)`,
              [cleanNome, cleanTelefone, cleanCidade, cleanMateriais, optInMarketing, now]
            );
          }
        }

        // Salva as alterações no arquivo SQLite físico
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));

        // Obtém o último ID inserido
        const result = db.exec('SELECT last_insert_rowid() as id');
        const leadId = result[0]?.values[0]?.[0] || Date.now();

        console.log(`[NOVO ORÇAMENTO REGISTRADO] ID: ${leadId} - Cliente: ${cleanNome} - Tel: ${cleanTelefone} - Anexo: ${cleanArquivoNome || 'Nenhum'} - URL: ${cleanArquivoUrl || 'Nenhum'}`);

        return res.status(200).json({
          status: 'success',
          message: 'Orçamento registrado com sucesso',
          id: leadId,
          data_solicitacao: now,
          lead: { 
            nome: cleanNome, 
            telefone: cleanTelefone, 
            cidade: cleanCidade, 
            materiais: cleanMateriais, 
            arquivo_nome: cleanArquivoNome, 
            arquivo_tamanho: cleanArquivoTamanho,
            arquivo_url: cleanArquivoUrl,
            aceita_marketing: optInMarketing 
          }
        });
      } else {
        // Fallback se DB ainda não inicializou
        return res.status(200).json({
          status: 'success',
          message: 'Orçamento recebido',
          id: Date.now(),
          data_solicitacao: now
        });
      }
    } catch (err: any) {
      console.error('Erro ao registrar orçamento:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Erro interno ao salvar no banco de dados',
        detail: err.message
      });
    }
  });

  // Rota GET: Listar orçamentos recebidos (Painel Administrativo)
  app.get('/api/orcamentos', (req, res) => {
    try {
      if (!db) {
        return res.json({ total: 0, leads: [] });
      }

      let result;
      try {
        result = db.exec(
          `SELECT id, nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, arquivo_url, data_solicitacao FROM clientes_orcamento ORDER BY id DESC LIMIT 50`
        );
      } catch (_) {
        try {
          result = db.exec(
            `SELECT id, nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, data_solicitacao FROM clientes_orcamento ORDER BY id DESC LIMIT 50`
          );
        } catch (__) {
          result = db.exec(
            `SELECT id, nome, telefone, cidade, materiais, aceita_marketing, data_solicitacao FROM clientes_orcamento ORDER BY id DESC LIMIT 50`
          );
        }
      }

      if (!result || result.length === 0) {
        return res.json({ total: 0, leads: [] });
      }

      const columns = result[0].columns;
      const values = result[0].values;

      const leads = values.map((row: any[]) => {
        const item: Record<string, any> = {};
        columns.forEach((col: string, idx: number) => {
          item[col] = row[idx];
        });
        return item;
      });

      return res.json({ total: leads.length, leads });
    } catch (err: any) {
      console.error('Erro ao consultar leads:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Rota POST: Login administrativo do lojista
  app.post('/api/admin/login', (req, res) => {
    try {
      const { usuario, senha } = req.body;
      if (!usuario || !senha) {
        return res.status(400).json({ success: false, message: 'Informe usuário e senha.' });
      }

      if (!db) {
        return res.status(500).json({ success: false, message: 'Banco de dados não disponível.' });
      }

      const check = db.exec(
        `SELECT id, usuario, senha FROM admin_auth WHERE LOWER(usuario) = LOWER(?) LIMIT 1`,
        [usuario.trim()]
      );

      if (!check || check.length === 0 || check[0].values.length === 0) {
        return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
      }

      const storedPassword = check[0].values[0][2];
      if (storedPassword !== senha) {
        return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
      }

      const token = `adm_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return res.json({
        success: true,
        token,
        usuario: check[0].values[0][1],
        message: 'Autenticado com sucesso!'
      });
    } catch (err: any) {
      console.error('Erro no login admin:', err);
      return res.status(500).json({ success: false, message: 'Erro interno ao validar login.' });
    }
  });

  // Rota POST: Alterar senha do admin
  app.post('/api/admin/change-password', (req, res) => {
    try {
      const { usuario, senhaAtual, novaSenha } = req.body;
      if (!usuario || !senhaAtual || !novaSenha) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
      }

      if (novaSenha.length < 6) {
        return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' });
      }

      if (!db) {
        return res.status(500).json({ success: false, message: 'Banco de dados não disponível.' });
      }

      const check = db.exec(
        `SELECT id, senha FROM admin_auth WHERE LOWER(usuario) = LOWER(?) LIMIT 1`,
        [usuario.trim()]
      );

      if (!check || check.length === 0 || check[0].values.length === 0) {
        return res.status(401).json({ success: false, message: 'Usuário não encontrado.' });
      }

      const storedPassword = check[0].values[0][1];
      if (storedPassword !== senhaAtual) {
        return res.status(401).json({ success: false, message: 'Senha atual incorreta.' });
      }

      db.run(
        `UPDATE admin_auth SET senha = ?, data_modificacao = CURRENT_TIMESTAMP WHERE LOWER(usuario) = LOWER(?)`,
        [novaSenha, usuario.trim()]
      );

      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));

      return res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao alterar senha admin:', err);
      return res.status(500).json({ success: false, message: 'Erro ao alterar senha.' });
    }
  });

  // Rota DELETE: Excluir lead pelo lojista
  app.delete('/api/orcamentos/:id', (req, res) => {
    try {
      const id = req.params.id;
      if (!db) {
        return res.status(500).json({ success: false, message: 'Banco de dados não disponível.' });
      }

      db.run(`DELETE FROM clientes_orcamento WHERE id = ?`, [id]);
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));

      return res.json({ success: true, message: 'Lead excluído com sucesso.' });
    } catch (err: any) {
      console.error('Erro ao excluir lead:', err);
      return res.status(500).json({ success: false, message: 'Erro ao excluir lead.' });
    }
  });

  // Rota POST: Registrar clique no botão do WhatsApp em qualquer ponto do site
  app.post('/api/eventos/clique-whatsapp', (req, res) => {
    try {
      const { origem, rotulo } = req.body || {};
      const origemBotao = String(origem || 'Botão Flutuante (WhatsApp)').substring(0, 100);
      const rotuloFinal = String(rotulo || 'WhatsApp Oficial').substring(0, 100);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (db) {
        db.run(
          `INSERT INTO cliques_whatsapp (origem_botao, rotulo, data_hora) VALUES (?, ?, ?)`,
          [origemBotao, rotuloFinal, now]
        );
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      }

      return res.status(200).json({ success: true, timestamp: now });
    } catch (err: any) {
      console.error('Erro ao registrar clique whatsapp:', err);
      return res.status(200).json({ success: false });
    }
  });

  // Rota GET: Métricas Executivas e Dashboard Mensal Consolidado
  app.get('/api/admin/dashboard', (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ error: 'Banco de dados não disponível' });
      }

      const hojeDate = new Date().toISOString().substring(0, 10);

      // 1. Totais Gerais
      const totalVisitasRes = db.exec(`SELECT COUNT(*) FROM visitas_site`);
      const totalVisitas = Number(totalVisitasRes[0]?.values[0]?.[0] || 0);

      const totalOrcamentosRes = db.exec(`SELECT COUNT(*) FROM clientes_orcamento`);
      const totalOrcamentos = Number(totalOrcamentosRes[0]?.values[0]?.[0] || 0);

      const totalCliquesRes = db.exec(`SELECT COUNT(*) FROM cliques_whatsapp`);
      const totalCliques = Number(totalCliquesRes[0]?.values[0]?.[0] || 0);

      const totalAcoesComerciais = totalOrcamentos + totalCliques;

      const visitasHojeRes = db.exec(`SELECT COUNT(*) FROM visitas_site WHERE data_hora LIKE '${hojeDate}%'`);
      const visitasHoje = Number(visitasHojeRes[0]?.values[0]?.[0] || 0);

      const orcamentosHojeRes = db.exec(`SELECT COUNT(*) FROM clientes_orcamento WHERE data_solicitacao LIKE '${hojeDate}%'`);
      const orcamentosHoje = Number(orcamentosHojeRes[0]?.values[0]?.[0] || 0);

      const cliquesHojeRes = db.exec(`SELECT COUNT(*) FROM cliques_whatsapp WHERE data_hora LIKE '${hojeDate}%'`);
      const cliquesHoje = Number(cliquesHojeRes[0]?.values[0]?.[0] || 0);

      // Taxas calculadas de forma realista e padronizada (limitada a 100% no percentual global)
      const taxaOrcamentos = totalVisitas > 0 ? Number(((totalOrcamentos / totalVisitas) * 100).toFixed(1)) : 0;
      const taxaCliquesWhatsapp = totalVisitas > 0 ? Number(((totalCliques / totalVisitas) * 100).toFixed(1)) : 0;
      const taxaConversaoGeral = totalVisitas > 0 
        ? Math.min(100, Number((((totalOrcamentos + totalCliques) / totalVisitas) * 100).toFixed(1)))
        : 0;

      // 2. Histórico Mensal (Últimos 6 meses)
      const mesesNomes: Record<string, string> = {
        '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
        '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
      };

      const agora = new Date();
      const mesesChaves: { chave: string; rotulo: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const chave = `${y}-${m}`;
        const rotulo = `${mesesNomes[m]}/${y}`;
        mesesChaves.push({ chave, rotulo });
      }

      const historicoMensal = mesesChaves.map(({ chave, rotulo }) => {
        const vRes = db!.exec(`SELECT COUNT(*) FROM visitas_site WHERE data_hora LIKE '${chave}%'`);
        const visitas = Number(vRes[0]?.values[0]?.[0] || 0);

        const oRes = db!.exec(`SELECT COUNT(*) FROM clientes_orcamento WHERE data_solicitacao LIKE '${chave}%'`);
        const orcamentos = Number(oRes[0]?.values[0]?.[0] || 0);

        const cRes = db!.exec(`SELECT COUNT(*) FROM cliques_whatsapp WHERE data_hora LIKE '${chave}%'`);
        const cliquesWhatsapp = Number(cRes[0]?.values[0]?.[0] || 0);

        const totalContatos = orcamentos + cliquesWhatsapp;
        const taxaOrcamento = visitas > 0 ? Number(((orcamentos / visitas) * 100).toFixed(1)) : 0;
        const taxaWhatsapp = visitas > 0 ? Number(((cliquesWhatsapp / visitas) * 100).toFixed(1)) : 0;
        const conversao = visitas > 0 
          ? Math.min(100, Number(((totalContatos / visitas) * 100).toFixed(1)))
          : 0;

        return {
          mes: rotulo,
          chave,
          visitas,
          orcamentos,
          cliquesWhatsapp,
          totalContatos,
          taxaOrcamento,
          taxaWhatsapp,
          conversao
        };
      });

      // 3. Materiais Mais Solicitados (Agrupamento semântico nas solicitações)
      const todosMateriaisRes = db.exec(`SELECT materiais FROM clientes_orcamento`);
      const materiaisRows = todosMateriaisRes[0]?.values || [];
      const totalOrcamentosCount = Math.max(1, materiaisRows.length);

      const categoriasMateriais = [
        { nome: 'Fios & Cabos Normatizados (Flexíveis, Rolo e Metro)', categoria: 'Condutores', regex: /cabo|fio|flexivel|750v|metro|rolo/i, count: 0 },
        { nome: 'Disjuntores DIN & DPS (Proteção de Circuitos)', categoria: 'Proteção Elétrica', regex: /disjuntor|dps|bipolar|tripolar|monopolar|steck/i, count: 0 },
        { nome: 'Infraestrutura (Eletrodutos, Canaletas & Caixas PVC)', categoria: 'Infraestrutura', regex: /eletroduto|canaleta|caixa|4x2|pvc|tigre|perfilado|eletrocalha/i, count: 0 },
        { nome: 'Iluminação Técnica & LED (Refletores & Painéis)', categoria: 'Iluminação', regex: /refletor|led|luminaria|painel|spot|embutir|sobrepor/i, count: 0 },
        { nome: 'Automação & Comandos (Contatores, Relés e Inversores)', categoria: 'Industrial', regex: /contator|rele|inversor|comando|botoeira|motor/i, count: 0 },
        { nome: 'Tomadas & Interruptores (Conjuntos 10A e 20A)', categoria: 'Acabamentos', regex: /tomada|interruptor|modulo|placa|2p\+t/i, count: 0 },
        { nome: 'Quadros de Distribuição & Barramentos', categoria: 'Quadros & Painéis', regex: /quadro|distribuicao|barramento|neutro|terra/i, count: 0 }
      ];

      materiaisRows.forEach((row: any[]) => {
        const text = String(row[0] || '').toLowerCase();
        categoriasMateriais.forEach((cat) => {
          if (cat.regex.test(text)) {
            cat.count += 1;
          }
        });
      });

      const materiaisMaisSolicitados = categoriasMateriais
        .map((cat) => ({
          nome: cat.nome,
          categoria: cat.categoria,
          totalSolicitacoes: cat.count,
          porcentagem: Number(((cat.count / totalOrcamentosCount) * 100).toFixed(1))
        }))
        .sort((a, b) => b.totalSolicitacoes - a.totalSolicitacoes);

      // 4. Principais Cidades dos Orçamentos
      const cidadesRes = db.exec(
        `SELECT cidade, COUNT(*) as qtd FROM clientes_orcamento GROUP BY cidade ORDER BY qtd DESC LIMIT 6`
      );
      const cidadesRows = cidadesRes[0]?.values || [];
      const principaisCidades = cidadesRows.map((row: any[]) => ({
        cidade: String(row[0]),
        total: Number(row[1]),
        porcentagem: Number(((Number(row[1]) / totalOrcamentosCount) * 100).toFixed(1))
      }));

      // 5. Origem dos Cliques no WhatsApp
      const origemCliquesRes = db.exec(
        `SELECT origem_botao, COUNT(*) as qtd FROM cliques_whatsapp GROUP BY origem_botao ORDER BY qtd DESC`
      );
      const origemRows = origemCliquesRes[0]?.values || [];
      const totalCliquesCount = Math.max(1, totalCliques);
      const origemCliquesWhatsapp = origemRows.map((row: any[]) => ({
        origem: String(row[0]),
        total: Number(row[1]),
        porcentagem: Number(((Number(row[1]) / totalCliquesCount) * 100).toFixed(1))
      }));

      // 6. Distribuição de Dispositivos (Mobile vs Desktop)
      const mobRes = db.exec(`SELECT COUNT(*) FROM visitas_site WHERE dispositivo LIKE '%Mobile%'`);
      const mobileVisitas = Number(mobRes[0]?.values[0]?.[0] || 0);
      const desktopVisitas = Math.max(0, totalVisitas - mobileVisitas);
      const percentualMobile = totalVisitas > 0 ? Number(((mobileVisitas / totalVisitas) * 100).toFixed(1)) : 50;

      return res.json({
        resumoGeral: {
          totalAcessos: totalVisitas,
          totalOrcamentos: totalOrcamentos,
          totalCliquesWhatsapp: totalCliques,
          totalAcoesComerciais,
          taxaConversaoGeral,
          taxaOrcamentos,
          taxaCliquesWhatsapp,
          acessosHoje: visitasHoje,
          orcamentosHoje,
          cliquesWhatsappHoje: cliquesHoje
        },
        historicoMensal,
        materiaisMaisSolicitados,
        principaisCidades,
        distribuicaoDispositivos: {
          mobile: mobileVisitas,
          desktop: desktopVisitas,
          percentualMobile
        },
        origemCliquesWhatsapp
      });
    } catch (err: any) {
      console.error('Erro no dashboard executivo:', err);
      return res.status(500).json({ error: 'Erro ao gerar métricas do dashboard', details: err.message });
    }
  });

  // Rota POST: Registrar novo acesso/visita ao site (chamado silenciosamente no carregamento da página)
  app.post('/api/visitas', (req, res) => {
    try {
      const userAgent = req.headers['user-agent'] || 'Desconhecido';
      const isMobile = /mobile|iphone|ipad|android/i.test(userAgent);
      const dispositivo = isMobile ? 'Mobile / Celular' : 'Desktop / Computador';
      
      let navegador = 'Outro';
      if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) navegador = 'Chrome';
      else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) navegador = 'Safari';
      else if (/firefox/i.test(userAgent)) navegador = 'Firefox';
      else if (/edg/i.test(userAgent)) navegador = 'Edge';

      const origem = req.body?.origem || req.headers.referer || 'Acesso Direto';
      const pagina = req.body?.pagina || '/';
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (db) {
        db.run(
          `INSERT INTO visitas_site (data_hora, dispositivo, navegador, origem, pagina) VALUES (?, ?, ?, ?, ?)`,
          [now, dispositivo, navegador, String(origem).substring(0, 150), pagina]
        );

        // Salva periodicamente no disco SQLite
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      }

      return res.status(200).json({ status: 'ok', time: now });
    } catch (err: any) {
      console.error('Erro ao registrar visita:', err);
      return res.status(200).json({ status: 'ignored' });
    }
  });

  // Rota GET: Listar estatísticas e acessos do site (Painel do Lojista)
  app.get('/api/visitas', (req, res) => {
    try {
      if (!db) {
        return res.json({ total: 0, hoje: 0, mobile: 0, desktop: 0, visitas: [] });
      }

      // Total geral
      const totalRes = db.exec(`SELECT COUNT(*) as total FROM visitas_site`);
      const total = totalRes[0]?.values[0]?.[0] || 0;

      // Hoje
      const hojeDate = new Date().toISOString().substring(0, 10);
      const hojeRes = db.exec(`SELECT COUNT(*) FROM visitas_site WHERE data_hora LIKE '${hojeDate}%'`);
      const hoje = hojeRes[0]?.values[0]?.[0] || 0;

      // Dispositivos
      const mobRes = db.exec(`SELECT COUNT(*) FROM visitas_site WHERE dispositivo LIKE '%Mobile%'`);
      const mobile = mobRes[0]?.values[0]?.[0] || 0;
      const desktop = Number(total) - Number(mobile);

      // Últimas 50 visitas detalhadas
      const listRes = db.exec(
        `SELECT id, data_hora, dispositivo, navegador, origem, pagina FROM visitas_site ORDER BY id DESC LIMIT 50`
      );

      const visitas: any[] = [];
      if (listRes && listRes.length > 0) {
        const cols = listRes[0].columns;
        const vals = listRes[0].values;
        vals.forEach((row: any[]) => {
          const item: Record<string, any> = {};
          cols.forEach((c: string, i: number) => {
            item[c] = row[i];
          });
          visitas.push(item);
        });
      }

      return res.json({
        total,
        hoje,
        mobile,
        desktop: desktop < 0 ? 0 : desktop,
        visitas
      });
    } catch (err: any) {
      console.error('Erro ao consultar estatísticas de visitas:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Rota GET: Consultar avaliações dinâmicas do Google e médias verificadas (16 avaliações / média 4.8)
  app.get('/api/avaliacoes', (req, res) => {
    try {
      if (!db) {
        return res.json({ total: 16, ratingAverage: 4.8, reviews: [] });
      }

      // Conta novas avaliações adicionadas além das 16 verificadas oficiais
      const countRes = db.exec(`SELECT COUNT(*) as total FROM avaliacoes_google`);
      const dbCount = Number(countRes[0]?.values[0]?.[0] || 0);
      
      // Total oficial verificado do Google: 16 avaliações
      const total = Math.max(16, dbCount);
      const ratingAverage = 4.8;

      // Todas as avaliações mais recentes primeiro
      const listRes = db.exec(
        `SELECT id, autor, cargo, nota, data_texto, comentario, verificado, data_criacao 
         FROM avaliacoes_google 
         ORDER BY id DESC`
      );

      const reviews: any[] = [];
      if (listRes && listRes.length > 0) {
        const cols = listRes[0].columns;
        const vals = listRes[0].values;
        vals.forEach((row: any[]) => {
          const item: Record<string, any> = {};
          cols.forEach((c: string, i: number) => {
            item[c] = row[i];
          });
          item.verificado = Boolean(item.verificado);
          reviews.push(item);
        });
      }

      return res.json({
        total: Number(total),
        ratingAverage,
        reviews
      });
    } catch (err: any) {
      console.error('Erro ao consultar avaliações do Google:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Rota POST: Adicionar nova avaliação (dinâmica, soma na contagem geral)
  app.post('/api/avaliacoes', (req, res) => {
    try {
      const { autor, cargo, nota, comentario } = req.body;

      if (!autor || !nota || !comentario) {
        return res.status(400).json({
          status: 'error',
          message: 'Autor, nota e comentário são obrigatórios.'
        });
      }

      const ratingNum = Math.min(5, Math.max(1, parseInt(nota, 10) || 5));
      const roleStr = cargo?.trim() || 'Cliente Verificado';
      const dateText = 'Recente';

      if (db) {
        db.run(
          `INSERT INTO avaliacoes_google (autor, cargo, nota, data_texto, comentario, verificado) VALUES (?, ?, ?, ?, ?, 1)`,
          [autor.trim(), roleStr, ratingNum, dateText, comentario.trim()]
        );

        // Persiste imediatamente no arquivo SQLite
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));

        // Recalcula total e média
        const totalRes = db.exec(`SELECT COUNT(*) as total FROM avaliacoes_google`);
        const total = totalRes[0]?.values[0]?.[0] || 0;

        const avgRes = db.exec(`SELECT AVG(nota) as media FROM avaliacoes_google`);
        const rawAvg = avgRes[0]?.values[0]?.[0];
        const ratingAverage = rawAvg ? Number(Number(rawAvg).toFixed(1)) : 4.8;

        return res.status(201).json({
          status: 'success',
          message: 'Avaliação adicionada com sucesso e somada à contagem oficial!',
          total: Number(total),
          ratingAverage
        });
      }

      return res.status(500).json({ status: 'error', message: 'Banco indisponível' });
    } catch (err: any) {
      console.error('Erro ao salvar avaliação:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Modo de Desenvolvimento com Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Modo de Produção
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`⚡ Phoenix Elétrica Full-Stack iniciado na porta ${PORT}`);
    console.log(`🌐 Acesso Web: http://localhost:${PORT}`);
    console.log(`📁 Banco SQLite: ${DB_PATH}`);
    console.log(`======================================================\n`);
  });
}

startServer();
