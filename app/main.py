from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers import platforms, data, dpp

app = FastAPI(title="Petrobras Platform Comparator API")

# CORS — temporariamente aberto para diagnosticar; restringir após validação
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(platforms.router)
app.include_router(data.router)
app.include_router(dpp.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "petrobras-platform-comparator-api"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
