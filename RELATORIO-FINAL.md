# Relatório Final — Base de Plataformas Offshore Brasileiras

**Data de consolidação:** outubro de 2026  
**Total de unidades únicas:** 123  
**Arquivos da base:** 10 (part-01 a part-10)  
**Fontes principais:** ANP (dados oficiais), inventário offshore global, MODEC, Petrobras, relatórios setoriais e imprensa especializada.

---

## 1. Composição por categoria

| Categoria | Quantidade |
|---|---|
| Unidades Petrobras operadas pela Petrobras (dados oficiais ANP) | 49 |
| Unidades Petrobras afretadas/operadas por terceiros | 2 |
| Unidades com participação histórica/atual da Petrobras | 2 |
| Unidades de outros operadores (comparação) | 70 |
| **Total** | **123** |

### Unidades Petrobras afretadas/terceirizadas
- **FPSO Cidade de São Mateus** — BW Offshore / Petrobras (afretamento), campos de Camarupim/Camarupim Norte, Bacia de Espírito Santo.
- **FPSO Forte (ex-P-50)** — PRIO FORTE S.A., campos de Albacora/Albacora Leste, Bacia de Campos.

### Unidades com participação da Petrobras
- **FPSO Fluminense** — Shell Brasil (80%) / Petrobras (20%), campos de Bijupirá-Salema, Bacia de Campos; produção encerrada em dezembro de 2021, unidade aguardando descomissionamento.
- **FPSO Frade** — PRIO (ex-Chevron); a Petrobras foi parceira (30%) até 2019, quando vendeu sua participação.

---

## 2. Distribuição por arquivo

| Arquivo | Unidades |
|---|---|
| part-01 | 12 |
| part-02 | 12 |
| part-03 | 12 |
| part-04 | 12 |
| part-05 | 12 |
| part-06 | 9 |
| part-07 | 23 |
| part-08 | 23 |
| part-09 | 4 |
| part-10 | 4 |
| **Total** | **123** |

---

## 3. Distribuição por status

| Status | Quantidade |
|---|---|
| Operacional | 68 |
| Em descomissionamento | 2 |
| Descomissionada | 52 |
| Operacional sem produção | 1 |
| **Total** | **123** |

---

## 4. Distribuição por tipo de unidade

- **FPSOs** — maioria da base (unidades flutuantes de produção, armazenamento e transferência).
- **Semissubmersíveis** — predominantemente unidades históricas da série P-xx já descomissionadas.
- **Plataformas fixas** — cerca de 18 unidades, concentradas nas bacias Potiguar, Camamu-Almada e Santos (Manati, Mexilhão, Pescada, PNA, PCH, PCR, PGM, PAR, PCE, PCM, PGA).
- **FSO** — unidades de armazenamento e transferência.

---

## 5. Distribuição por bacia

- **Bacia de Campos** — maior concentração (Marlim, Albacora, Roncador, Bijupirá-Salema, Frade, Jubarte, Golfinho, etc.).
- **Bacia de Santos** — pré-sal (Lula, Sapinhoá, Iracema, Lapa, Búzios, Mero, Sépia, Atapu, Tartaruga Verde) e campos pós-sal.
- **Bacia de Espírito Santo** — Golfinho, Camarupim, Cachalote, Baleia.
- **Bacia Potiguar** — Pescada, Ubarana, Agulhinha, etc.
- **Bacia de Camamu-Almada** — Manati.
- **Bacia de Sergipe** — Piranema.

---

## 6. Qualidade e rastreabilidade dos dados

- **49 unidades Petrobras** possuem dados oficiais da ANP (instalacoes_maritimas_em_operacao_04_2026.csv), com coordenadas, produção e status validados.
- **Unidades históricas descomissionadas** (série P-01 a P-71) possuem dados parciais, conforme disponibilidade de fontes públicas.
- **Coordenadas:** exatas para a maioria das unidades ANP; aproximadas para algumas unidades históricas e para o FPSO Cidade de São Mateus (centro do campo de Camarupim).
- **Produção:** valores de pico/capacidade instalada; para o Manati, atualizado com a produção média de 2021 (255 bpd de condensado e 3,2 milhões m³/dia de gás).
- **Duplicidades:** 3 duplicidades foram identificadas e removidas (Guanabara/P-81, Cidade de Campos dos Goytacazes e Cidade de Niterói), garantindo 123 unidades únicas.

---

## 7. Histórico de consolidação

| Commit | Descrição |
|---|---|
| `e54802f` | Remoção de 3 duplicidades — base passa de 122 para 119 unidades únicas |
| `0ed2ca4` | Adição do part-10 (Cidade de São Mateus e Forte) e atualização do Manati — 121 unidades |
| `a858cf3` | Adição do FPSO Fluminense e FPSO Frade — 123 unidades |

---

## 8. Observações finais

- A base cobre **todas as 49 unidades Petrobras operadas pela Petrobras** listadas pela ANP, além de unidades afretadas, parceiras e históricas.
- Unidades como a **P-36** (naufragada em 2001) não foram incluídas por se tratarem de naufrágios históricos, sem operação.
- A base é atualizada continuamente conforme novas fontes e unidades entrarem em operação.

**Relatório gerado automaticamente a partir da consolidação da base em outubro de 2026.**
