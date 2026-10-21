import axios from "axios";
import type { MonthlyProduction, Platform } from "./types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "https://petrobras-platform-comparator-api.onrender.com",
  timeout: 30000,
});

function extractPlatforms(payload: unknown): Platform[] {
  if (Array.isArray(payload)) return payload as Platform[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["platforms", "items", "results", "data"])
      if (Array.isArray(record[key])) return record[key] as Platform[];
  }
  return [];
}

export async function fetchPlatforms(): Promise<Platform[]> {
  const { data } = await api.get("/api/platforms");
  return extractPlatforms(data);
}

export async function fetchProductionHistory(slug: string): Promise<MonthlyProduction[]> {
  const { data } = await api.get<MonthlyProduction[]>(`/api/platforms/${slug}/production`);
  return Array.isArray(data) ? data : [];
}
