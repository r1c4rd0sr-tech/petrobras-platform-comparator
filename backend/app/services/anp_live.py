"""Serviço que busca dados ao vivo da API ANP "Do Poço ao Posto" (DPP).

A cada chamada, a base estática de unidades é enriquecida com a produção
mais recente do Boletim Mensal de Produção (BMP) por campo, filtrada pelos
CNPJs da Petrobras. Se a ANP estiver indisponível, cai para os dados estáticos.
"""
from __future__ import annotations

import calendar
import glob
import json
import os
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

BASE_URL = "https://dpp-api.anp.gov.br"
DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "platforms"))

ENDPOINTS = {
    "production_by_field": "/api/upstream-campo/campo/ListarProducaoPorCampo",
    "wells": "/api/upstream-poco/lista-pocos",
    "fields": "/api/upstream-campo/campo",
    "basins": "/api/upstream-bacia/bacias",
}

PETROBRAS_CNPJ_ROOTS = ("33000167",)
M3_TO_BBL = 6.2898


def _get_json(path: str, params: Optional[Dict[str, Any]] = None, timeout: int = 45) -> Any:
    url = BASE_URL + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "petrobras-platform-comparator/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _normalize(text: Any) -> str:
    return str(text or "").strip().lower()


def _is_petrobras(item: Dict[str, Any]) -> bool:
    cnpj = str(item.get("cnpj") or item.get("Cnpj") or "")
    digits = "".join(ch for ch in cnpj if ch.isdigit())
    if any(digits.startswith(root) for root in PETROBRAS_CNPJ_ROOTS):
        return True
    return "petrobras" in _normalize(item.get("razaoSocial") or item.get("RazaoSocial"))


def _as_list(payload: Any, *keys: str) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in keys:
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def _parse_period(period: Any) -> Tuple[int, int]:
    text = str(period or "")
    for sep in ("-", "/"):
        if sep in text:
            parts = text.split(sep)
            if len(parts) >= 2:
                try:
                    return int(parts[0]), int(parts[1])
                except ValueError:
                    pass
    return 0, 0


def _days_in_period(period: Any) -> int:
    year, month = _parse_period(period)
    if year and month:
        return calendar.monthrange(year, month)[1]
    return 30


def _load_static() -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "part-*.json"))):
        with open(path, encoding="utf-8") as fh:
            records.extend(json.load(fh))
    return records


def _build_production_index(payload: Any) -> Dict[str, Dict[str, Any]]:
    index: Dict[str, Dict[str, Any]] = {}
    for item in _as_list(payload, "dados", "data"):
        if not _is_petrobras(item):
            continue
        campo = _normalize(item.get("campo") or item.get("Campo") or item.get("nomeCampo"))
        if not campo:
            continue
        current = index.get(campo)
        period = str(item.get("periodo") or item.get("Periodo") or "")
        if current is None or period > str(current.get("periodo") or current.get("Periodo") or ""):
            index[campo] = item
    return index


def get_live_platforms() -> List[Dict[str, Any]]:
    """Retorna a base de unidades enriquecida com produção ANP ao vivo.

    Em caso de falha na ANP, retorna os dados estáticos sem alteração.
    """
    records = _load_static()
    try:
        production_index = _build_production_index(_get_json(ENDPOINTS["production_by_field"]))
    except Exception:  # noqa: BLE001
        return records

    for rec in records:
        campo = _normalize(rec.get("field"))
        prod = production_index.get(campo)
        if not prod:
            continue
        oil_m3 = prod.get("producaoPetrolioRoyalties_m3") or prod.get("producaoPetrolioRoyalties") or 0
        gas_m3 = prod.get("producaoGasNaturalRoyalties_m3") or prod.get("producaoGasNaturalRoyalties") or 0
        period = prod.get("periodo") or prod.get("Periodo")
        days = _days_in_period(period)
        try:
            oil_m3 = float(oil_m3)
            gas_m3 = float(gas_m3)
        except (TypeError, ValueError):
            continue
        rec["anp_oil_m3_monthly"] = oil_m3
        rec["anp_gas_m3_monthly"] = gas_m3
        rec["anp_production_period"] = period
        if oil_m3 > 0:
            rec["oil_bpd"] = round(oil_m3 * M3_TO_BBL / days, 1)
        if gas_m3 > 0:
            rec["gas_mmd"] = round(gas_m3 / 1_000_000 / days, 3)
    return records