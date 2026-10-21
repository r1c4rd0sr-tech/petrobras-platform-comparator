# Petrobras Platform Comparator

Plataforma web para comparar unidades marítimas da Petrobras: mapa interativo, filtros, indicadores, gráficos comparativos e histórico de dados.

## Stack recomendada

- **Backend:** Python 3.12 + FastAPI + SQLAlchemy + Pydantic
- **Banco:** SQLite para desenvolvimento; PostgreSQL para produção
- **Frontend:** TypeScript + React + Vite
- **Mapa:** Leaflet + react-leaflet
- **Gráficos:** Recharts
- **Dados:** JSON versionado em `data/`, com importação para o banco
- **Automação:** GitHub Actions para testes, build e atualização agendada de dados

## Estrutura

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   ├── routers/
│   │   │   └── platforms.py
│   │   └── services/
│   │       └── data_import.py
│   ├── data/
│   │   └── platforms.json
│   ├── tests/
│   │   └── test_api.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── components/
│   │   │   ├── PlatformMap.tsx
│   │   │   ├── PlatformFilters.tsx
│   │   │   ├── ComparisonCharts.tsx
│   │   │   └── ProductionHistory.tsx
│   │   └── types.ts
│   ├── package.json
│   └── vite.config.ts
├── .github/workflows/ci.yml
└── docker-compose.yml
```

## Funcionalidades planejadas

- Cadastro e comparação de até N unidades
- Mapa com coordenadas, status, tipo, bacia, campo e operador
- Filtros por produção de óleo, gás, BOEd, ano, acomodação e distância da costa
- Gráficos comparativos: barras, dispersão, radar e séries temporais
- Histórico por unidade: produção mensal, alterações cadastrais e fontes
- Verificação online de alterações em fontes públicas ou planilhas/CSV
- Exportação CSV/JSON e API pública documentada

## Execução local

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

A documentação automática fica em:

```text
http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Próximos passos

1. Substituir `platforms.json` pela base completa do comparador V2.7
2. Criar tabela `monthly_production` com `platform_id`, `year_month`, `oil_bpd`, `gas_mmd`, `uptime` e `source_url`
3. Criar tabela `data_snapshots` para guardar cada alteração e permitir auditoria
4. Implementar coletor agendado no GitHub Actions
5. Publicar frontend no Vercel/Netlify e backend no Render/Railway/Fly.io
