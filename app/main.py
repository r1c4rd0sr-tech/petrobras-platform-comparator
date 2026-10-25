from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers import platforms, data, dpp

app = FastAPI(title="Petrobras Platform Comparator API")

# CORS via CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CORS manual (garantia adicional — headers explícitos)
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

app.include_router(platforms.router)
app.include_router(data.router)
app.include_router(dpp.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "petrobras-platform-comparator-api"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.options("/{path:path}")
def options_handler(path: str):
    return Response(status_code=200, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    })
