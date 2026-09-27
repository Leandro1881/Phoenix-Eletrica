"""
Script utilitário para listar todos os orçamentos cadastrados no SQLite.
Para executar:
    python view_leads.py
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "phoenix_eletrica.db")
if not os.path.exists(DB_PATH):
    # Se rodar dentro da pasta backend/
    DB_PATH = "phoenix_eletrica.db"

def listar_todos():
    if not os.path.exists(DB_PATH):
        print(f"\n[AVISO] Banco de dados '{DB_PATH}' ainda não foi criado.")
        print("Envie o primeiro formulário pela página para gerar os registros.\n")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, nome, telefone, cidade, materiais, data_solicitacao 
            FROM clientes_orcamento 
            ORDER BY id DESC
        """)
        rows = cursor.fetchall()

        print("\n" + "=" * 80)
        print(f"  PHOENIX ELÉTRICA - REGISTROS DA TABELA 'clientes_orcamento' ({len(rows)} leads)")
        print("=" * 80)

        if not rows:
            print("  Nenhum orçamento encontrado na tabela.")
        else:
            for r in rows:
                print(f"\n[ID #{r['id']}] Data: {r['data_solicitacao']}")
                print(f"  Cliente : {r['nome']}")
                print(f"  Telefone: {r['telefone']}")
                print(f"  Cidade  : {r['cidade']}")
                print(f"  Materiais: {r['materiais']}")
                print("-" * 80)

        print("\n" + "=" * 80 + "\n")

    except sqlite3.OperationalError as e:
        print(f"\n[ERRO] Tabela clientes_orcamento não encontrada: {e}\n")
    finally:
        conn.close()

if __name__ == "__main__":
    listar_todos()
