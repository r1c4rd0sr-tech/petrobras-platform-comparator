from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import platforms, data, dpp, refino, temporal

app = FastAPI(title="Petrobras Platform Comparator API")

# CORS — usa regex para aceitar subdomínios da Vercel (ex.: www) e localhost para dev
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https://(www\.)?petrobras-platform-comparator\.vercel\.app$|^http://localhost:(5173|3000)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(platforms.router)
app.include_router(data.router)
app.include_router(dpp.router)
app.include_router(refino.router)
app.include_router(temporal.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "petrobras-platform-comparator-api"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
