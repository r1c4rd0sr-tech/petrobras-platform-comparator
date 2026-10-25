export async function fetchProducaoHistorica(campo: string, meses = 36) {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/dpp/producao?campo=${encodeURIComponent(campo)}&meses=${meses}`);
  if (!res.ok) throw new Error(`Erro ao carregar série histórica: ${res.status}`);
  return res.json();
}
