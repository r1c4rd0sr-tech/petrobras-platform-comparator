import csv
import io
import unicodedata
import zipfile
from datetime import date
from functools import lru_cache

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/dpp", tags=["dpp"])

BASE = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "arquivos/arquivos-producao-de-petroleo-e-gas-natural-por-poco"
)

JANELA_FIM_ANO = 2023
JANELA_FIM_MES = 10
JANELA_INICIO_ANO = 2021
JANELA_INICIO_MES = 1


def _normalizar(texto: str) -> str:
    """Remove acentos, lowercase e trim — para matching tolerante."""
    sem_acento = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return sem_acento.strip().casefold()


def _url_zip(ano: int, mes: int | None) -> str:
    if ano <= 2020:
        return f"{BASE}/producao-por-poco-{ano}.zip"
    return f"{BASE}/{ano}/producao-{ano}-{mes:02d}.zip"


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


@lru_cache(maxsize=64)
def _csvs_de_zip(url: str) -> tuple[str, ...]:
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
    textos = []
    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        for nome in z.namelist():
            if nome.lower().endswith(".csv"):
                textos.append(_decode(z.read(nome)))
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
            # Match exato normalizado OU contenção (ex.: "Buzios" encontra "Búzios")
            if nome_norm != alvo and alvo not in nome_norm and nome_norm not in alvo:
                continue
            if periodo is None:
                periodo = (linha.get("Período") or "").strip()
            total_oleo += _parse_float(linha.get("Óleo (bbl/dia)") or "0")
            total_gas += _parse_float(linha.get("Gás Natural (Mm³/dia)") or "0")
    if periodo is None:
        return None
    return {"periodo": periodo, "campo": campo, "oleo_bpd": round(total_oleo, 2), "gas_mmd": round(total_gas, 3)}


def _janela(meses: int) -> list[tuple[int, int]]:
    pares = []
    ano, mes = JANELA_FIM_ANO, JANELA_FIM_MES
    while (ano > JANELA_INICIO_ANO) or (ano == JANELA_INICIO_ANO and mes >= JANELA_INICIO_MES):
        pares.append((ano, mes))
        if len(pares) >= meses:
            break
        mes -= 1
        if mes == 0:
            mes = 12
            ano -= 1
    return pares


@router.get("/producao")
async def producao(
    campo: str = Query(..., description="Nome do campo de produção"),
    meses: int = Query(36, ge=1, le=36, description="Meses históricos (máx. 33)"),
    ano: int | None = Query(None, description="Ano específico para teste pontual"),
    mes: int | None = Query(None, ge=1, le=12, description="Mês específico para teste pontual"),
):
    """Série histórica por campo — matching tolerante a acentos e variações de nome."""
    if ano and mes:
        url = _url_zip(ano, mes)
        try:
            csvs = _csvs_de_zip(url)
            registro = _agregar_por_campo(csvs, campo)
            return {
                "campo": campo,
                "periodo": f"{ano}-{mes:02d}",
                "dados": [registro] if registro else [],
                "avisos": [] if registro else ["Campo não encontrado nos CSVs deste mês"],
            }
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Falha ao consultar ZIP {ano}-{mes:02d}: {e}")

    dados = []
    avisos = []
    for a, m in _janela(meses):
        url = _url_zip(a, m)
        try:
            csvs = _csvs_de_zip(url)
            registro = _agregar_por_campo(csvs, campo)
            if registro:
                dados.append(registro)
        except Exception as e:
            avisos.append(f"{a}-{m:02d}: {e}")

    dados.sort(key=lambda r: r["periodo"])
    return {"campo": campo, "meses": meses, "dados": dados, "avisos": avisos}


@router.get("/debug")
async def debug(ano: int = Query(...), mes: int = Query(..., ge=1, le=12)):
    url = _url_zip(ano, mes)
    try:
        csvs = _csvs_de_zip(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao consultar ZIP: {e}")
    amostras = []
    for i, texto in enumerate(csvs):
        leitor = _dict_reader(texto)
        cabecalhos = leitor.fieldnames or []
        primeira = next(iter(leitor), {})
        amostras.append({"csv_index": i, "colunas": cabecalhos, "amostra": primeira})
    return {"url": url, "csvs": amostras}
