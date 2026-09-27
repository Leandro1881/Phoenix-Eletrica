"""
API Backend Alternativa em Flask para Phoenix Elétrica
Framework: Flask + SQLite3
Requisitos: flask, flask-cors
Para rodar:
    pip install flask flask-cors
    python flask_app.py
"""

import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Permite requisições de outros domínios / portas

DB_NAME = "phoenix_eletrica.db"


def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
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
    print("[FLASK] Tabela clientes_orcamento criada/verificada com sucesso.")


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "empresa": "Phoenix Elétrica",
        "backend": "Flask + SQLite",
        "status": "online"
    })


@app.route("/api/orcamentos", methods=["POST"])
def criar_orcamento():
    """
    Recebe o POST do formulário, valida os campos, insere no SQLite
    e retorna HTTP 200 para permitir que o frontend redirecione ao WhatsApp.
    """
    dados = request.get_json(force=True, silent=True)
    if not dados:
        return jsonify({"status": "error", "message": "Corpo da requisição inválido (JSON esperado)"}), 400

    nome = dados.get("nome", "").strip()
    telefone = dados.get("telefone", "").strip()
    cidade = dados.get("cidade", "").strip()
    materiais = dados.get("materiais", "").strip()

    if not nome or not telefone or not cidade or not materiais:
        return jsonify({
            "status": "error",
            "message": "Todos os campos (nome, telefone, cidade, materiais) são obrigatórios."
        }), 400

    try:
        conn = get_db()
        cursor = conn.cursor()
        data_atual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        query = """
            INSERT INTO clientes_orcamento (nome, telefone, cidade, materiais, data_solicitacao)
            VALUES (?, ?, ?, ?, ?)
        """
        cursor.execute(query, (nome, telefone, cidade, materiais, data_atual))
        conn.commit()
        lead_id = cursor.lastrowid
        conn.close()

        print(f"[FLASK - NOVO LEAD] ID {lead_id} | Cliente: {nome} | Tel: {telefone}")

        return jsonify({
            "status": "success",
            "message": "Orçamento registrado com sucesso",
            "id": lead_id,
            "data_solicitacao": data_atual
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/orcamentos", methods=["GET"])
def listar_orcamentos():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM clientes_orcamento ORDER BY id DESC")
        rows = cursor.fetchall()
        conn.close()

        leads = [dict(r) for r in rows]
        return jsonify({"total": len(leads), "leads": leads}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    init_db()
    print("Iniciando Flask em http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=True)
