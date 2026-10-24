# Changelog

## v1.0.0 (2026-10-24)

### Adicionado
- 123 plataformas marítimas (Seção 1)
- 10 campos/unidades terrestres (Seção 2)
- 53 unidades de Refino, Gás e Logística (Seção 3): 12 refinarias, 19 terminais, 1 UTGCAB, 8 UTGNs, 13 ECOMPs
- Filtros específicos por categoria (bacia, campo, operador, óleo, gás, ano, acomodação, poços, estado, município, armazenamento)
- Mapa interativo com pins coloridos por unidade selecionada (até 10)
- Gráficos comparativos (Recharts) e rankings
- Tema claro/escuro
- 27 testes automatizados (Vitest + React Testing Library) — 27/27 passando
- CI com execução automática dos testes e upload de resultados JUnit
- Commit automático do test-results.xml para correção iterativa de falhas

### Corrigido
- Ordenação por óleo/gás/BOE (mapeamento oil→oil_bpd, gas→gas_mmd, boed→boed)
- Acessibilidade dos filtros (htmlFor/id)
- ID duplicado da UTG Candeias
- Duplicações de Paulínia e Araucária entre refinarias.json e ecomps-gasbol.json
