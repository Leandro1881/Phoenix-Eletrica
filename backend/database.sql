-- ============================================================================
-- PHOENIX ELÉTRICA - Script SQL de Criação de Banco de Dados e Tabelas
-- Compatível com SQLite, PostgreSQL e MySQL
-- ============================================================================

-- 1. Criação da Tabela 'clientes_orcamento'
CREATE TABLE IF NOT EXISTS clientes_orcamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    cidade TEXT NOT NULL,
    materiais TEXT NOT NULL,
    data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Criação da Tabela 'visitas_site' (Rastreamento de Tráfego / Acessos Gerais)
CREATE TABLE IF NOT EXISTS visitas_site (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dispositivo TEXT,
    navegador TEXT,
    origem TEXT,
    pagina TEXT
);

-- 3. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_clientes_data ON clientes_orcamento (data_solicitacao DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes_orcamento (telefone);
CREATE INDEX IF NOT EXISTS idx_visitas_data ON visitas_site (data_hora DESC);

-- 3. Exemplo de Inserção de Lead (Query executada pelo Backend na rota POST /api/orcamentos)
INSERT INTO clientes_orcamento (nome, telefone, cidade, materiais, data_solicitacao)
VALUES (
    'Eng. Marcos Roberto',
    '(11) 98323-9782',
    'São Paulo - SP',
    '10 rolos de cabo flexível 4mm², 6 disjuntores bipolares 32A, 1 quadro de embutir 24 disjuntores',
    datetime('now', 'localtime')
);

-- 4. Exemplo de Consulta para o Painel Administrativo de Leads
SELECT 
    id, 
    nome, 
    telefone, 
    cidade, 
    materiais, 
    data_solicitacao 
FROM clientes_orcamento 
ORDER BY id DESC;
