export interface Platform {
  id: number;
  slug: string;
  name: string;
  status: string;
  unit_type: string;
  basin: string | null;
  field: string | null;
  operator: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_to_coast_km: number | null;
  year: number | null;
  oil_bpd: number | null;
  gas_mmd: number | null;
  boed: number | null;
  accommodation: number | null;
  storage_m3: number | null;
  length_m: number | null;
  weight_t: number | null;
  source_url: string | null;
  updated_at: string;
}

export interface MonthlyProduction {
  id: number;
  platform_id: number;
  period: string;
  oil_bpd: number | null;
  gas_mmd: number | null;
  boed: number | null;
  uptime_percent: number | null;
  source_url: string | null;
}
