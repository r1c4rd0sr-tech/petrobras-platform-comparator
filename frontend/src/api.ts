export const API_BASE = import.meta.env.VITE_API_URL ?? "https://petrobras-platform-comparator.onrender.com";

const DPP_API_BASE = "https://dpp-api.anp.gov.br/api";

async function getJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Falha ao carregar dados: ${response.status}`);
  }
  return response.json();
}

export async function fetchPlatforms() {
  return getJson("/api/platforms");
}

export async function fetchOnshore() {
  return getJson("/api/data/onshore");
}

export async function fetchRefinarias() {
  return getJson("/api/data/refinarias");
}

export async function fetchTerminaisArmazenamento() {
  return getJson("/api/data/terminais-armazenamento");
}

export async function fetchUtgnsGas() {
  return getJson("/api/data/utgns-gas");
}

export async function fetchEcompsGasbol() {
  return getJson("/api/data/ecomps-gasbol");
}

// Consulta o Boletim Mensal de Produção (BMP) da ANP para um campo específico.
// Etapa 1 da reintegração DPP: apenas a função, sem uso na UI.
export async function fetchProducaoHistorica(campo: string) {
  const response = await fetch(
    `${DPP_API_BASE}/upstream-campo/campo/ListarProducaoPorCampo`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campo }),
    }
  );
  if (!response.ok) {
    throw new Error(`Falha ao consultar produção histórica: ${response.status}`);
  }
  return response.json();
}
