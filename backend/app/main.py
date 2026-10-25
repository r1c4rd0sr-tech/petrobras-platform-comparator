from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import platforms, data, dpp

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
app.include_router(data.router)
app.include_router(dpp.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "petrobras-platform-comparator-api"}
