import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode, Terminal, Database, Globe } from 'lucide-react';

interface CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PYTHON_FASTAPI_CODE = `"""
API Backend para captação de orçamentos da Phoenix Elétrica
Framework: FastAPI + SQLite3
Requisitos: fastapi, uvicorn, pydantic

Instalação:
    pip install fastapi uvicorn pydantic

Execução:
    uvicorn app:app --reload --port 8000
"""

import sqlite3
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_NAME = "phoenix_eletrica.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes_orcamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT NOT NULL,
            cidade TEXT NOT NULL,
            materiais TEXT NOT NULL,
            data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
    print("[BANCO DE DADOS] Tabela clientes_orcamento pronta!")

app = FastAPI(title="Phoenix Elétrica - API de Orçamentos", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()

class OrcamentoRequest(BaseModel):
    nome: str = Field(..., min_length=2, max_length=150)
    telefone: str = Field(..., min_length=8, max_length=30)
    cidade: str = Field(..., min_length=2, max_length=100)
    materiais: str = Field(..., min_length=3)

@app.post("/api/orcamentos", status_code=status.HTTP_200_OK)
def criar_orcamento(dados: OrcamentoRequest):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        data_atual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        query = """
            INSERT INTO clientes_orcamento (nome, telefone, cidade, materiais, data_solicitacao)
            VALUES (?, ?, ?, ?, ?)
        """
        cursor.execute(query, (dados.nome, dados.telefone, dados.cidade, dados.materiais, data_atual))
        conn.commit()
        lead_id = cursor.lastrowid
        conn.close()

        print(f"[NOVO LEAD] ID {lead_id} | {dados.nome} | {dados.cidade}")

        return {
            "status": "success",
            "message": "Orçamento registrado com sucesso",
            "id": lead_id,
            "data_solicitacao": data_atual
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/orcamentos")
def listar_orcamentos(limit: Optional[int] = 50):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM clientes_orcamento ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return {"total": len(rows), "leads": [dict(r) for r in rows]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)`;

const SQL_CODE = `-- ============================================================================
-- PHOENIX ELÉTRICA - Script SQL de Criação de Banco de Dados e Tabelas
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

-- 2. Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_clientes_data ON clientes_orcamento (data_solicitacao DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes_orcamento (telefone);

-- 3. Query executada pelo Backend ao receber o formulário (POST /api/orcamentos):
INSERT INTO clientes_orcamento (nome, telefone, cidade, materiais, data_solicitacao)
VALUES (
    'Carlos Silva',
    '(11) 98323-9782',
    'São Paulo - SP',
    '3 rolos cabo flexível 2.5mm², 4 disjuntores monopolares 20A Curva C',
    datetime('now', 'localtime')
);

-- 4. Query de consulta dos leads (GET /api/orcamentos):
SELECT 
    id, 
    nome, 
    telefone, 
    cidade, 
    materiais, 
    data_solicitacao 
FROM clientes_orcamento 
ORDER BY id DESC;`;

const GIT_COMMANDS = `# ============================================================================
# PASSO A PASSO PARA RODAR LOCALMENTE E COMMITAR NO GIT
# ============================================================================

# 1. Clonar o repositório ou criar o projeto:
mkdir phoenix-eletrica
cd phoenix-eletrica

# 2. Configurar o Backend Python:
cd backend
python -m venv venv

# Ativar ambiente virtual:
# No Linux/macOS:
source venv/bin/activate
# No Windows:
venv\\Scripts\\activate

# Instalar dependências:
pip install fastapi uvicorn pydantic

# Iniciar o servidor Python:
uvicorn app:app --reload --port 8000

# 3. Testar a requisição de cadastro via cURL no terminal:
curl -X POST http://localhost:8000/api/orcamentos \\
  -H "Content-Type: application/json" \\
  -d '{
    "nome": "Engenheiro Marcos",
    "telefone": "(11) 98323-9782",
    "cidade": "Campinas - SP",
    "materiais": "5 rolos de cabo 4mm, 2 disjuntores tripolares 40A"
  }'

# 4. Commitar no Git:
git init
git add .
git commit -m "feat: landing page Phoenix Eletrica com backend Python e SQLite"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/phoenix-eletrica.git
git push -u origin main`;

export const CodeModal: React.FC<CodeModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'python' | 'sql' | 'git'>('python');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentCode =
    activeTab === 'python'
      ? PYTHON_FASTAPI_CODE
      : activeTab === 'sql'
      ? SQL_CODE
      : GIT_COMMANDS;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename =
      activeTab === 'python'
        ? 'app.py'
        : activeTab === 'sql'
        ? 'database.sql'
        : 'setup_instructions.sh';
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111e33] border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#0e1829]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-['Syne',sans-serif]">
                Código do Projeto (Backend Python + SQL)
              </h3>
              <p className="text-xs text-slate-400">
                Arquivos completos prontos para rodar localmente e commitar no Git
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="px-6 pt-4 bg-[#0e1829] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('python')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'python'
                  ? 'bg-[#0b1320] text-orange-400 border-t-2 border-orange-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>app.py (FastAPI)</span>
            </button>

            <button
              onClick={() => setActiveTab('sql')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'sql'
                  ? 'bg-[#0b1320] text-orange-400 border-t-2 border-orange-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>database.sql (SQLite)</span>
            </button>

            <button
              onClick={() => setActiveTab('git')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'git'
                  ? 'bg-[#0b1320] text-orange-400 border-t-2 border-orange-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Instruções & Git</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2 sm:pb-0">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-medium text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Arquivo</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#0b1320]">
          <pre className="font-mono text-xs text-slate-300 whitespace-pre leading-relaxed overflow-x-auto p-4 rounded-xl bg-[#070d17] border border-slate-800 selection:bg-orange-500 selection:text-white">
            {currentCode}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0e1829] flex items-center justify-between text-xs text-slate-400">
          <span>
            Arquivos físicos disponíveis no diretório <code className="text-orange-400 font-mono">/backend</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
