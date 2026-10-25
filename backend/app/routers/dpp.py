import asyncio
import csv
import io
import unicodedata
import zipfile

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/dpp", tags=["dpp"])

BASE = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "arquivos/arquivos-producao-de-petroleo-e-gas-natural-por-poco"
)

# URLs exatas dos ZIPs (padrões irregulares por período) — 2021-01 a 2023-12
URLS = {
    "2021-01": f"{BASE}/2021_01_producao.zip",
    "2021-02": f"{BASE}/2021_02_producao.zip",
    "2021-03": f"{BASE}/2021_03_producao.zip",
    "2021-04": f"{BASE}/2021_04_producao.zip",
    "2021-05": f"{BASE}/2021_05_producao.zip",
    "2021-06": f"{BASE}/2021_06_producao.zip",
    "2021-07": f"{BASE}/2021_07_producao.zip",
    "2021-08": f"{BASE}/2021-08-producao.zip",
    "2021-09": f"{BASE}/2021-09-producao.zip",
    "2021-10": f"{BASE}/2021-10-producao.zip",
    "2021-11": f"{BASE}/2021-11-producao.zip",
    "2021-12": f"{BASE}/2021-12-producao.zip",
    "2022-01": f"{BASE}/2022/producao-2022-01.zip",
    "2022-02": f"{BASE}/2022/producao-2022-02.zip",
    "2022-03": f"{BASE}/2022/producao-2022-03.zip",
    "2022-04": f"{BASE}/2022/producao-2022-04.zip",
    "2022-05": f"{BASE}/2022/2022_05_producao.zip",
    "2022-06": f"{BASE}/2022/producao-2022-06.zip",
    "2022-07": f"{BASE}/2022/producao-2022-07.zip",
    "2022-08": f"{BASE}/2022/producao-2022-08.zip",
    "2022-09": f"{BASE}/2022/producao-2022-09.zip",
    "2022-10": f"{BASE}/2022/producao-2022-10.zip",
    "2022-11": f"{BASE}/2022/2022_11_producao.zip",
    "2022-12": f"{BASE}/2022/2022_12_producao.zip",
    "2023-01": f"{BASE}/2023/producao-01.zip",
    "2023-02": f"{BASE}/2023/producao-02.zip",
    "2023-03": f"{BASE}/2023/producao-03.zip",
    "2023-04": f"{BASE}/2023/producao-04.zip",
    "2023-05": f"{BASE}/2023/producao-05.zip",
    "2023-06": f"{BASE}/2023/producao-06.zip",
    "2023-07": f"{BASE}/2023/producao-07.zip",
    "2023-08": f"{BASE}/2023/producao-08.zip",
    "2023-09": f"{BASE}/2023/producao-09.zip",
    "2023-10": f"{BASE}/2023/producao-10.zip",
    "2023-11": f"{BASE}/2023/producao-11.zip",
    "2023-12": f"{BASE}/2023/producao-12.zip",
}

# Cache em memória: URL do ZIP -> tupla de textos CSV
_cache_zip: dict[str, tuple[str, ...]] = {}


def _normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return sem_acento.strip().casefold()


def _parse_float(value: str) -> float:
    if not value:
        return 0.0
    return float(str(value).replace(".", "").replace(",", "."))


def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def _dict_reader(texto: str):
    cabecalho = texto.splitlines()[0] if texto else ""
    delim = ";" if cabecalho.count(";") > cabecalho.count(",") else ","
    return csv.DictReader(io.StringIO(texto), delimiter=delim)


async def _csvs_de_zip(client: httpx.AsyncClient, url: str) -> tuple[str, ...]:
    if url in _cache_zip:
        return _cache_zip[url]
    resp = await client.get(url)
    resp.raise_for_status()
    textos = []
    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        for nome in z.namelist():
            if nome.lower().endswith(".csv"):
                textos.append(_decode(z.read(nome)))
    _cache_zip[url] = tuple(textos)
    return tuple(textos)


def _agregar_por_campo(csvs: tuple[str, ...], campo: str) -> dict | None:
    total_oleo = 0.0
    total_gas = 0.0
    periodo = None
    alvo = _normalizar(campo)
    for csv_texto in csvs:
        leitor = _dict_reader(csv_texto)
        for linha in leitor:
            nome = (linha.get("Campo") or "").strip()
            if not nome:
                continue
            nome_norm = _normalizar(nome)
            if nome_norm != alvo and alvo not in nome_norm and nome_norm not in alvo:
                continue
            if periodo is None:
                periodo = (linha.get("Período") or "").strip()
            total_oleo += _parse_float(linha.get("Óleo (bbl/dia)") or "0")
            total_gas += _parse_float(linha.get("Gás Natural (Mm³/dia)") or "0")
    if periodo is None:
        return None
    return {"periodo": periodo, "campo": campo, "oleo_bpd": round(total_oleo, 2), "gas_mmd": round(total_gas, 3)}


def _janela(meses: int) -> list[str]:
    """Retorna os últimos 'meses' períodos disponíveis em URLS (mais recentes primeiro)."""
    periodos = sorted(URLS.keys(), reverse=True)
    return periodos[:meses]


@router.get("/producao")
async def producao(
    campo: str = Query(..., description="Nome do campo de produção"),
    meses: int = Query(36, ge=1, le=36, description="Meses históricos (máx. 36)"),
):
    """Série histórica por campo — ZIPs paralelos com URLs exatas (2021-2023)."""
    janela = _janela(meses)
    dados = []
    avisos = []
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        tarefas = [_csvs_de_zip(client, URLS[p]) for p in janela]
        resultados = await asyncio.gather(*tarefas, return_exceptions=True)

    for periodo, res in zip(janela, resultados):
        if isinstance(res, Exception):
            avisos.append(f"{periodo}: {res}")
            continue
        registro = _agregar_por_campo(res, campo)
        if registro:
            dados.append(registro)

    dados.sort(key=lambda r: r["periodo"])
    return {"campo": campo, "meses": meses, "dados": dados, "avisos": avisos, "fonte": "zip_anp"}


@router.get("/debug")
async def debug(periodo: str = Query(..., description="Período no formato YYYY-MM")):
    url = URLS.get(periodo)
    if not url:
        raise HTTPException(status_code=404, detail=f"Período {periodo} não disponível")
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            csvs = await _csvs_de_zip(client, url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao consultar ZIP: {e}")
    amostras = []
    for i, texto in enumerate(csvs):
        leitor = _dict_reader(texto)
        cabecalhos = leitor.fieldnames or []
        primeira = next(iter(leitor), {})
        amostras.append({"csv_index": i, "colunas": cabecalhos, "amostra": primeira})
    return {"url": url, "csvs": amostras}
