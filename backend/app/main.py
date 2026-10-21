import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import platforms
from .services.data_import import import_platforms_from_json

app = FastAPI(title="Petrobras Platform Comparator API", version="0.1.0")

allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,https://petrobras-platform-comparator.vercel.app,https://petrobras-platform-comparator-5yf6yofjn-rsrautomacao.vercel.app",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(platforms.router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    from .database import SessionLocal

    with SessionLocal() as db:
        import_platforms_from_json(db)


@app.get("/api/health")
def health():
    return {"status": "ok"}
