export const API_BASE = import.meta.env.VITE_API_URL ?? "https://petrobras-platform-comparator.onrender.com";

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
