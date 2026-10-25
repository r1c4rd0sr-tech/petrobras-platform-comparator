import sqlite3

from fastapi import APIRouter

router = APIRouter(prefix="/api/dpp", tags=["dpp"])

# Banco SQLite criado a partir dos ZIPs da ANP (2021-2023).
# Mantido para uso futuro — endpoint /producao removido a pedido do usuário.
