# Phoenix Elétrica - Backend de Orçamentos (Python + SQLite)

Este diretório contém a API backend para receber os dados do formulário de orçamento, salvá-los no banco de dados SQLite e responder ao frontend para que ele efetue o redirecionamento automático para o WhatsApp da Phoenix Elétrica.

---

## 🚀 Como Rodar Localmente

### 1. Criar e ativar o ambiente virtual (venv)
```bash
# No terminal, navegue até a pasta do projeto:
cd backend

# Crie o ambiente virtual
python -m venv venv

# Ative o ambiente virtual:
# No Linux/Mac:
source venv/bin/activate
# No Windows:
venv\Scripts\activate
```

### 2. Instalar as dependências
```bash
pip install -r requirements.txt
```

### 3. Executar o Servidor FastAPI (Recomendado)
```bash
uvicorn app:app --reload --port 8000
```
- A API estará rodando em: `http://localhost:8000`
- Documentação interativa Swagger: `http://localhost:8000/docs`
- Documentação Redoc: `http://localhost:8000/redoc`

*OU*, se preferir rodar com Flask:
```bash
python flask_app.py
```

---

## 🗄️ Estrutura do Banco de Dados (SQLite)

O arquivo `phoenix_eletrica.db` é criado automaticamente na primeira execução com a tabela:

```sql
CREATE TABLE IF NOT EXISTS clientes_orcamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    cidade TEXT NOT NULL,
    materiais TEXT NOT NULL,
    data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📡 Rota da API

### `POST /api/orcamentos`
- **Headers:** `Content-Type: application/json`
- **Corpo da requisição (JSON):**
```json
{
  "nome": "Carlos Oliveira",
  "telefone": "(11) 98323-9782",
  "cidade": "São Paulo - SP",
  "materiais": "4 rolos cabo 2.5mm², 2 disjuntores 32A DIN"
}
```

- **Resposta de Sucesso (HTTP 200 OK):**
```json
{
  "status": "success",
  "message": "Orçamento registrado com sucesso",
  "id": 1,
  "data_solicitacao": "2026-09-25 20:30:00"
}
```

---

## 🐙 Como Commitar no Git

```bash
git add backend/
git commit -m "feat(backend): adiciona API FastAPI/Flask com persistencia SQLite para orcamentos da Phoenix Eletrica"
git push origin main
```
