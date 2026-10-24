#!/usr/bin/env python3
"""Enriquece a base de unidades com dados da API ANP "Do Poço ao Posto" (DPP).

O que este script faz:
1. Consulta /api/upstream-empresa/ListarTodasEmpresas para obter o CNPJ da Petrobras.
2. Consulta /api/upstream-poco/lista-pocos para obter os poços e filtrar os da Petrobras.
3. Consulta /api/upstream-campo/campo e /api/upstream-bacia/bacias para enriquecer campo e bacia.
4. Cruza poços com unidades (plataformas/FPSOs) via nome do campo e adiciona novos campos:
   - well_count: nº de poços da Petrobras no campo da unidade
   - field_code: código SIGEP do campo
   - basin_code: código da bacia
   - anp_wells: lista resumida dos poços vinculados ao campo
5. NÃO sobrescreve oil_bpd/gas_mmd/boed: a seção de produção depende da confirmação
   dos endpoints exatos do nó "Producao" no Swagger (não visíveis na listagem pública
   recuperada). Quando confirmados, preencha PRODUCTION_ENDPOINTS abaixo.

Uso:
    python backend/scripts/enrich_from_anp_dpp.py
"""
from __future__ import annotations

import glob
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

BASE_URL = "https://dpp-api.anp.gov.br"

# Endpoints confirmados na documentação Swagger da ANP.
ENDPOINTS = {
    "companies": "/api/upstream-empresa/ListarTodasEmpresas",
    "wells": "/api/upstream-poco/lista-pocos",
    "fields": "/api/upstream-campo/campo",
    "basins": "/api/upstream-bacia/bacias",
    "installations": "/api/instalacao",
}

# Endpoints de produção ainda a confirmar no Swagger.
# Quando confirmados, preencha aqui e a seção apply_production passará a rodar.
PRODUCTION_ENDPOINTS: Dict[str, str] = {
    # Exemplo hipotético — NÃO usar até validar no Swagger:
    # "production": "/api/upstream-producao/producao",
}

# CNPJs conhecidos da Petrobras (raiz). Ajuste conforme necessário.
PETROBRAS_CNPJ_ROOTS = ("33000167",)  # Petrobras S.A.


def http_get_json(path: str, params: Optional[Dict[str, Any]] = None, retries: int = 3) -> Any:
    """Faz GET na API DPP e retorna JSON; lança exceção após esgotar tentativas."""
    url = BASE_URL + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    last_error: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "petrobras-platform-comparator/1.0"})
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


def load_platform_files(data_dir: str) -> List[str]:
    return sorted(glob.glob(os.path.join(data_dir, "part-*.json")))


def build_field_index(fields_payload: Any) -> Dict[str, Dict[str, Any]]:
    index: Dict[str, Dict[str, Any]] = {}
    items = fields_payload if isinstance(fields_payload, list) else fields_payload.get("dados", fields_payload.get("data", []))
    for item in items or []:
        name = normalize(item.get("nome") or item.get("Nome") or item.get("nomeCampo"))
        if name:
            index[name] = item
    return index


def build_basin_index(basins_payload: Any) -> Dict[str, Dict[str, Any]]:
    index: Dict[str, Dict[str, Any]] = {}
    items = basins_payload if isinstance(basins_payload, list) else basins_payload.get("dados", basins_payload.get("data", []))
    for item in items or []:
        name = normalize(item.get("nome") or item.get("Nome") or item.get("nomeBacia"))
        if name:
            index[name] = item
    return index


def extract_wells(wells_payload: Any) -> List[Dict[str, Any]]:
    if isinstance(wells_payload, list):
        return wells_payload
    for key in ("dados", "data", "pocos", "wells"):
        if isinstance(wells_payload, dict) and isinstance(wells_payload.get(key), list):
            return wells_payload[key]
    return []


def apply_enrichment(records: List[Dict[str, Any]], field_index: Dict[str, Dict[str, Any]], basin_index: Dict[str, Dict[str, Any]], wells: List[Dict[str, Any]]) -> int:
    """Adiciona campos novos às unidades com base em campo/bacia/poços da Petrobras."""
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
        new_fields = {
            "field_code": field_info.get("codigo") or field_info.get("Codigo") or field_info.get("codigoCampo"),
            "basin_code": basin_info.get("codigo") or basin_info.get("Codigo") or basin_info.get("codigoBacia"),
            "well_count": len(wells_by_field.get(campo, [])),
            "anp_field_status": field_info.get("descricaoSituacao") or field_info.get("situacao"),
        }
        changed = False
        for key, value in new_fields.items():
            if value is not None and rec.get(key) != value:
                rec[key] = value
                changed = True
        if changed:
            updated += 1
    return updated


def apply_production(records: List[Dict[str, Any]]) -> int:
    """Reservado para produção: só roda quando PRODUCTION_ENDPOINTS for confirmado."""
    if not PRODUCTION_ENDPOINTS:
        print("[aviso] Endpoints de produção ainda não confirmados; oil_bpd/gas_mmd/boed não foram alterados.")
        return 0
    # Implementar aqui quando os endpoints de produção forem validados no Swagger.
    return 0


def main() -> None:
    data_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "platforms"))
    files = load_platform_files(data_dir)
    if not files:
        print("Nenhum arquivo part-*.json encontrado.")
        sys.exit(1)

    print("Consultando empresas...")
    companies = http_get_json(ENDPOINTS["companies"])
    print("Consultando poços...")
    wells_payload = http_get_json(ENDPOINTS["wells"])
    wells = extract_wells(wells_payload)
    print(f"Poços retornados: {len(wells)}")

    print("Consultando campos e bacias...")
    fields_payload = http_get_json(ENDPOINTS["fields"])
    basins_payload = http_get_json(ENDPOINTS["basins"])
    field_index = build_field_index(fields_payload)
    basin_index = build_basin_index(basins_payload)

    total_updated = 0
    for path in files:
        with open(path, encoding="utf-8") as fh:
            records = json.load(fh)
        updated = apply_enrichment(records, field_index, basin_index, wells)
        updated += apply_production(records)
        if updated:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(records, fh, ensure_ascii=False, indent=2)
                fh.write("\n")
        total_updated += updated
    print(f"Registros enriquecidos: {total_updated}")


if __name__ == "__main__":
    main()