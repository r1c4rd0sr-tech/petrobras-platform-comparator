import axios from "axios";
import type { MonthlyProduction, Platform } from "./types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

export async function fetchPlatforms(params: Record<string, unknown> = {}) {
  const { data } = await api.get<Platform[]>("/api/platforms", { params });
  return data;
}

export async function fetchProductionHistory(slug: string) {
  const { data } = await api.get<MonthlyProduction[]>(`/api/platforms/${slug}/production`);
  return data;
}
