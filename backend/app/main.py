from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import platforms, onshore, refinarias, terminais_armazenamento, utgns_gas, ecomps_gasbol, dpp

app = FastAPI(title="Petrobras Platform Comparator API")

# CORS — permite a origem da Vercel e localhost para dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://petrobras-platform-comparator.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(platforms.router)
app.include_router(onshore.router)
app.include_router(refinarias.router)
app.include_router(terminais_armazenamento.router)
app.include_router(utgns_gas.router)
app.include_router(ecomps_gasbol.router)
app.include_router(dpp.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "petrobras-platform-comparator-api"}
