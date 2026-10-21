# Petrobras Platform Comparator

Plataforma web para comparar unidades marítimas da Petrobras: mapa interativo, filtros, indicadores, gráficos comparativos e histórico de dados.

## Stack

- Backend: Python 3.12 + FastAPI + SQLAlchemy + Pydantic
- Banco: SQLite para desenvolvimento; PostgreSQL para produção
- Frontend: TypeScript + React + Vite
- Mapa: Leaflet + react-leaflet
- Gráficos: Recharts
- CI: GitHub Actions

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Documentação: http://localhost:8000/docs

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Interface: http://localhost:5173

## Endpoints

- GET /api/platforms
- GET /api/platforms/{slug}
- GET /api/platforms/{slug}/production
- POST /api/platforms/{slug}/production
