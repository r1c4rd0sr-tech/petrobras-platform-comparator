const API_BASE = import.meta.env.VITE_API_URL ?? "https://petrobras-platform-comparator.onrender.com";

export async function fetchPlatforms() {
  const response = await fetch(`${API_BASE}/api/platforms`);
  if (!response.ok) {
    throw new Error(`Falha ao carregar dados: ${response.status}`);
  }
  return response.json();
}