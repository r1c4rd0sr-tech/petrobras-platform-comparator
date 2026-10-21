from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import platforms
from .services.data_import import import_platforms_from_json

app = FastAPI(title="Petrobras Platform Comparator API", version="0.1.0")

app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
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
