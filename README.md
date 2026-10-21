# Petrobras Platform Comparator

Plataforma web para comparar unidades marítimas da Petrobras: mapa interativo, filtros, indicadores, gráficos comparativos e histórico de dados.

## Stack

- Backend: Python 3.12 + FastAPI + SQLAlchemy + Pydantic
- Banco: SQLite para desenvolvimento; PostgreSQL para produção
- Frontend: TypeScript + React + Vite
- Mapa: Leaflet + react-leaflet
- Gráficos: Recharts
- CI: GitHub Actions

## Testar no GitHub Codespaces

1. Abra o repositório no GitHub.
2. Clique em **Code → Codespaces → Create codespace on main**.
3. Aguarde o ambiente criar e instalar as dependências.
4. No terminal, inicie a API:

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

5. Abra a porta **8000** quando o Codespaces oferecer.
6. A documentação estará em `/docs`.

Para o frontend, abra outro terminal:

```bash
cd frontend
npm run dev -- --host
```

Depois abra a porta **5173**.

Se um Codespace antigo apresentar erro ao instalar `pydantic-core`, use **Codespaces → Rebuild container**. O projeto está configurado para usar Python 3.12.

## Execução local

### Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Documentação: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Interface: http://localhost:5173

## Endpoints

- `GET /api/platforms`
- `GET /api/platforms/{slug}`
- `GET /api/platforms/{slug}/production`
- `POST /api/platforms/{slug}/production`

## Base de dados

A base inicial contém 71 unidades marítimas, dividida em:

```text
backend/data/platforms/part-01.json
backend/data/platforms/part-02.json
backend/data/platforms/part-03.json
backend/data/platforms/part-04.json
backend/data/platforms/part-05.json
backend/data/platforms/part-06.json
```

O importador carrega automaticamente todos os arquivos `part-*.json` na inicialização da API.
