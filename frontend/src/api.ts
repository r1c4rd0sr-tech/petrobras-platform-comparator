import axios from "axios";
import type { MonthlyProduction, Platform } from "./types";

const api = axios.create({ baseURL: "/api" });

export async function fetchPlatforms(params: Record<string, unknown> = {}) {
  const { data } = await api.get<Platform[]>("/platforms", { params });
  return data;
}

export async function fetchProductionHistory(slug: string) {
  const { data } = await api.get<MonthlyProduction[]>(`/platforms/${slug}/production`);
  return data;
}
