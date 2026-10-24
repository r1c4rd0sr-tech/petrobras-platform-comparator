// POB (Persons On Board) pesquisados em fontes públicas (2026)
// Aplicados como override sobre o campo accommodation retornado pela API.
// Fontes: Ocyan, Trident (LinkedIn), DatamarNews, Actemium, ANP, Estado RS, Quatria Naval.

export const POB_OVERRIDES: Record<string, number> = {
  "p-35": 160,
  "p-53": 240,
  "p-55": 100,
  "p-58": 110,
  "p-62": 160,
  "p-63": 120,
  "p-65": 96,
  "p-74": 142,
  "p-75": 142,
  "p-76": 142,
  "p-77": 142,
  "p-79": 180,
  "almirante-barroso": 160,
  "cidade-de-itaguai": 70,
  "p-08": 166,
  "fpso-anna-nery": 39,
  "pce-1": 172,
  "pch-1": 176,
};
