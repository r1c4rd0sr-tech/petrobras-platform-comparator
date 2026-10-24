# Unidades Terrestres — Estrutura da Base

Esta pasta contém a base de **unidades terrestres** da Petrobras e de outros operadores, totalmente separada da base de unidades marítimas (offshore).

## Regra de separação

- **Unidades terrestres só são comparadas com outras unidades terrestres.**
- **Unidades marítimas (offshore) só são comparadas com outras unidades marítimas.**
- Não há comparação cruzada entre as duas modalidades.

## Estrutura de arquivos

- `onshore-part-01.json` — primeiras unidades terrestres (polos de produção e UPGNs).
- Novos arquivos (`onshore-part-02.json`, etc.) serão adicionados conforme a base crescer.

## Campos do schema

| Campo | Descrição |
|---|---|
| `slug` | Identificador único da unidade |
| `name` | Nome da unidade |
| `unit_type` | Tipo (polo_producao, upgn, base, campo) |
| `state` | Estado (UF) |
| `municipality` | Município |
| `basin` | Bacia sedimentar |
| `operator` | Operador |
| `status` | Status operacional |
| `year_start` | Ano de início da operação |
| `oil_bpd` | Produção de óleo (barris/dia) |
| `gas_mmd` | Produção/processamento de gás (milhões m³/dia) |
| `boed` | Produção total equivalente (boe/dia) |
| `wells_productive` | Poços produtivos |
| `notes` | Observações e detalhes |
| `source_url` | Fonte dos dados |
| `data_version` | Versão dos dados |

## Unidades já cadastradas

1. **Polo Urucu** — maior província terrestre de óleo e gás do Brasil, em Coari (AM).
2. **UPGN do Complexo de Energias Boaventura** — maior unidade de processamento de gás natural do país, em Itaboraí (RJ).

## Próximos passos

- Adicionar Poço Fundo (BA) e outros campos terrestres.
- Adicionar UPGN de Catu (BA) e GasLub.
- Adicionar bases e instalações de apoio.
