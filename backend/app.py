"""
API Backend para captação de orçamentos da Phoenix Elétrica
Framework: FastAPI + SQLite3
Requisitos: fastapi, uvicorn, pydantic
Para rodar:
    pip install fastapi uvicorn pydantic
    uvicorn app:app --reload --port 8000
"""

import sqlite3
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Configurações do Banco de Dados SQLite
# -----------------------------------------------------------------------------
DB_NAME = "phoenix_eletrica.db"


def get_db_connection():
    """Retorna uma conexão com o banco de dados configurada com row_factory."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Cria a tabela 'clientes_orcamento' caso ela ainda não exista."""
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
    print("[BANCO DE DADOS] Tabela 'clientes_orcamento' inicializada com sucesso!")


# -----------------------------------------------------------------------------
# Aplicação FastAPI
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Phoenix Elétrica - API de Orçamentos",
    description="API para recebimento e persistência de solicitações de orçamentos (leads).",
    version="1.0.0"
)

# Configuração de CORS para permitir requisições do frontend local e web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, restrinja aos domínios autorizados
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Inicializa o banco de dados ao iniciar a aplicação
@app.on_event("startup")
def startup_event():
    init_db()


# -----------------------------------------------------------------------------
# Modelos Pydantic (Validação de Dados)
# -----------------------------------------------------------------------------
class OrcamentoRequest(BaseModel):
    nome: str = Field(..., min_length=2, max_length=150, description="Nome completo do cliente")
    telefone: str = Field(..., min_length=8, max_length=30, description="Telefone de contato / WhatsApp")
    cidade: str = Field(..., min_length=2, max_length=100, description="Cidade e UF do cliente")
    materiais: str = Field(..., min_length=3, description="Lista de materiais ou produtos desejados")

    class Config:
        json_schema_extra = {
            "example": {
                "nome": "Carlos Silva",
                "telefone": "(11) 98323-9782",
                "cidade": "São Paulo - SP",
                "materiais": "3 rolos de cabo 2.5mm² azul, 2 rolos 2.5mm² vermelho, 4 disjuntores monopolares 20A Steck"
            }
        }


class OrcamentoResponse(BaseModel):
    status: str
    message: str
    id: int
    data_solicitacao: str


# -----------------------------------------------------------------------------
# Rotas da API
# -----------------------------------------------------------------------------
@app.get("/")
def home():
    """Rota raiz com status da API."""
    return {
        "empresa": "Phoenix Elétrica",
        "servico": "API de Captação de Orçamentos",
        "status": "online",
        "docs": "/docs"
    }


@app.post(
    "/api/orcamentos",
    status_code=status.HTTP_200_OK,
    summary="Registrar nova solicitação de orçamento"
)
@app.post("/api/orcamentos/", include_in_schema=False)
def criar_orcamento(dados: OrcamentoRequest):
    """
    Recebe os dados do formulário de orçamento, insere na tabela 'clientes_orcamento'
    e retorna status 200 para liberar o redirecionamento do WhatsApp no frontend.
    """
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

        print(f"[NOVO LEAD] ID {lead_id} - Cliente: {dados.nome} | Cidade: {dados.cidade}")

        return {
            "status": "success",
            "message": "Orçamento registrado com sucesso",
            "id": lead_id,
            "data_solicitacao": data_atual,
            "lead": {
                "nome": dados.nome,
                "telefone": dados.telefone,
                "cidade": dados.cidade,
                "materiais": dados.materiais
            }
        }

    except Exception as e:
        print(f"[ERRO SQL] Falha ao inserir lead: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao salvar no banco de dados: {str(e)}"
        )


@app.get(
    "/api/orcamentos",
    summary="Listar todos os orçamentos recebidos (Painel Admin)"
)
@app.get("/api/orcamentos/", include_in_schema=False)
def listar_orcamentos(limit: Optional[int] = 50):
    """Retorna os leads mais recentes cadastrados no banco SQLite."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, nome, telefone, cidade, materiais, data_solicitacao 
            FROM clientes_orcamento 
            ORDER BY id DESC 
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        conn.close()

        leads = [dict(row) for row in rows]
        return {
            "total": len(leads),
            "leads": leads
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# Bloco Principal para Execução Direta
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("  PHOENIX ELÉTRICA - SERVIDOR BACKEND PYTHON")
    print("  Iniciando em http://localhost:8000")
    print("  Documentação interativa Swagger: http://localhost:8000/docs")
    print("=" * 60 + "\n")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
