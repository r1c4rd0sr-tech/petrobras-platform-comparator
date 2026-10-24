#!/usr/bin/env python3
"""Enriquece a base de unidades com dados da API ANP "Do Poço ao Posto" (DPP).

O que este script faz:
1. Consulta /api/upstream-empresa/ListarTodasEmpresas para obter o CNPJ da Petrobras.
2. Consulta /api/upstream-poco/lista-pocos para obter os poços e filtrar os da Petrobras.
3. Consulta /api/upstream-campo/campo e /api/upstream-bacia/bacias para enriquecer campo e bacia.
4. Consulta /api/upstream-campo/campo/ListarProducaoPorCampo (BMP) para obter produção
   mensal de óleo (m³) e gás (m³) por campo, filtrando pelos CNPJs da Petrobras.
5. Cruza produção por campo com unidades (plataformas/FPSOs) via nome do campo e:
   - Adiciona campos novos: anp_oil_m3_monthly, anp_gas_m3_monthly, anp_production_period,
     field_code, basin_code, well_count, anp_field_status.
   - Substitui oil_bpd e gas_mmd com taxas diárias derivadas da produção mensal ANP
     (óleo: m³ -> barris -> /dias do período; gás: m³ -> MMm³ -> /dias do período).
   - boed não é alterado (não há fator de conversão gás->BOE confiável sem dados adicionais).

Uso:
    python backend/scripts/enrich_from_anp_dpp.py
"""
from __future__ import annotations

import calendar
import glob
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

BASE_URL = "https://dpp-api.anp.gov.br"

# Endpoints confirmados na documentação Swagger da ANP.
ENDPOINTS = {
    "companies": "/api/upstream-empresa/ListarTodasEmpresas",
    "wells": "/api/upstream-poco/lista-pocos",
    "fields": "/api/upstream-campo/campo",
    "basins": "/api/upstream-bacia/bacias",
    "production_by_field": "/api/upstream-campo/campo/ListarProducaoPorCampo",
}

# CNPJs conhecidos da Petrobras (raiz). Ajuste conforme necessário.
PETROBRAS_CNPJ_ROOTS = ("33000167",)  # Petrobras S.A.

M3_TO_BBL = 6.2898  # 1 m³ = 6,2898 barris


def http_get_json(path: str, params: Optional[Dict[str, Any]] = None, retries: int = 3) -> Any:
    """Faz GET na API DPP e retorna JSON; lança exceção após esgotar tentativas."""
    url = BASE_URL + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    last_error: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "User-Agent": "petrobras-platform-comparator/1.0"},
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(2 * attempt)
    raise RuntimeError(f"Falha ao consultar {url}: {last_error}")


def normalize(text: Any) -> str:
    return str(text or "").strip().lower()


def is_petrobras(item: Dict[str, Any]) -> bool:
    cnpj = str(item.get("cnpj") or item.get("Cnpj") or "")
    cnpj_digits = "".join(ch for ch in cnpj if ch.isdigit())
    if any(cnpj_digits.startswith(root) for root in PETROBRAS_CNPJ_ROOTS):
        return True
    razao = normalize(item.get("razaoSocial") or item.get("RazaoSocial") or "")
    return "petrobras" in razao


def as_list(payload: Any, *keys: str) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in keys:
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def parse_period(period: Any) -> Tuple[int, int]:
    """Extrai (ano, mês) de um período no formato 'YYYY-MM' ou similar."""
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


def days_in_period(period: Any) -> int:
    year, month = parse_period(period)
    if year and month:
        return calendar.monthrange(year, month)[1]
    return 30


def build_field_index(fields_payload: Any) -> Dict[str, Dict[str, Any]]:
    index: Dict[str, Dict[str, Any]] = {}
    for item in as_list(fields_payload, "dados", "data"):
        name = normalize(item.get("nome") or item.get("Nome") or item.get("nomeCampo"))
        if name:
            index[name] = item
    return index


def build_basin_index(basins_payload: Any) -> Dict[str, Dict[str, Any]]:
    index: Dict[str, Dict[str, Any]] = {}
    for item in as_list(basins_payload, "dados", "data"):
        name = normalize(item.get("nome") or item.get("Nome") or item.get("nomeBacia"))
        if name:
            index[name] = item
    return index


def build_production_index(production_payload: Any) -> Dict[str, Dict[str, Any]]:
    """Índice campo -> registro de produção mais recente da Petrobras."""
    index: Dict[str, Dict[str, Any]] = {}
    for item in as_list(production_payload, "dados", "data"):
        if not is_petrobras(item):
            continue
        campo = normalize(item.get("campo") or item.get("Campo") or item.get("nomeCampo"))
        if not campo:
            continue
        current = index.get(campo)
        if current is None or str(item.get("periodo") or item.get("Periodo") or "") > str(current.get("periodo") or current.get("Periodo") or ""):
            index[campo] = item
    return index


def apply_enrichment(
    records: List[Dict[str, Any]],
    field_index: Dict[str, Dict[str, Any]],
    basin_index: Dict[str, Dict[str, Any]],
    wells: List[Dict[str, Any]],
    production_index: Dict[str, Dict[str, Any]],
) -> int:
    """Adiciona campos novos e substitui oil_bpd/gas_mnd com dados ANP quando houver match."""
    wells_by_field: Dict[str, List[Dict[str, Any]]] = {}
    for well in wells:
        if not is_petrobras(well):
            continue
        campo = normalize(well.get("nomeCampo") or well.get("campo") or well.get("NomeCampo"))
        if campo:
            wells_by_field.setdefault(campo, []).append(well)

    updated = 0
    for rec in records:
        campo = normalize(rec.get("field"))
        bacia = normalize(rec.get("basin"))
        if not campo:
            continue
        field_info = field_index.get(campo, {})
        basin_info = basin_index.get(bacia, {})
        prod = production_index.get(campo)

        new_fields: Dict[str, Any] = {
            "field_code": field_info.get("codigo") or field_info.get("Codigo") or field_info.get("codigoCampo"),
            "basin_code": basin_info.get("codigo") or basin_info.get("Codigo") or basin_info.get("codigoBacia"),
            "well_count": len(wells_by_field.get(campo, [])),
            "anp_field_status": field_info.get("descricaoSituacao") or field_info.get("situacao"),
        }

        if prod:
            oil_m3 = prod.get("producaoPetrolioRoyalties_m3") or prod.get("producaoPetrolioRoyalties") or 0
            gas_m3 = prod.get("producaoGasNaturalRoyalties_m3") or prod.get("producaoGasNaturalRoyalties") or 0
            period = prod.get("periodo") or prod.get("Periodo")
            days = days_in_period(period)
            try:
                oil_m3 = float(oil_m3)
                gas_m3 = float(gas_m3)
            except (TypeError, ValueError):
                oil_m3, gas_m3 = 0.0, 0.0
            new_fields["anp_oil_m3_monthly"] = oil_m3
            new_fields["anp_gas_m3_monthly"] = gas_m3
            new_fields["anp_production_period"] = period
            if oil_m3 > 0:
                new_fields["oil_bpd"] = round(oil_m3 * M3_TO_BBL / days, 1)
            if gas_m3 > 0:
                new_fields["gas_mmd"] = round(gas_m3 / 1_000_000 / days, 3)

        changed = False
        for key, value in new_fields.items():
            if value is not None and rec.get(key) != value:
                rec[key] = value
                changed = True
        if changed:
            updated += 1
    return updated


def main() -> None:
    data_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "platforms"))
    files = sorted(glob.glob(os.path.join(data_dir, "part-*.json")))
    if not files:
        print("Nenhum arquivo part-*.json encontrado.")
        sys.exit(1)

    print("Consultando empresas...")
    companies = http_get_json(ENDPOINTS["companies"])
    print("Consultando poços...")
    wells = as_list(http_get_json(ENDPOINTS["wells"]), "dados", "data", "pocos", "wells")
    print(f"Poços retornados: {len(wells)}")

    print("Consultando campos, bacias e produção (BMP)...")
    fields_payload = http_get_json(ENDPOINTS["fields"])
    basins_payload = http_get_json(ENDPOINTS["basins"])
    production_payload = http_get_json(ENDPOINTS["production_by_field"])

    field_index = build_field_index(fields_payload)
    basin_index = build_basin_index(basins_payload)
    production_index = build_production_index(production_payload)
    print(f"Campos com produção da Petrobras: {len(production_index)}")

    total_updated = 0
    for path in files:
        with open(path, encoding="utf-8") as fh:
            records = json.load(fh)
        updated = apply_enrichment(records, field_index, basin_index, wells, production_index)
        if updated:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(records, fh, ensure_ascii=False, indent=2)
                fh.write("\n")
        total_updated += updated
    print(f"Registros enriquecidos: {total_updated}")


if __name__ == "__main__":
    main()