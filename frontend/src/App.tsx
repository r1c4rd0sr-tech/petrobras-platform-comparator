import { useEffect, useState } from "react";
import ComparisonCharts from "./components/ComparisonCharts";
import PlatformFilters from "./components/PlatformFilters";
import PlatformMap from "./components/PlatformMap";
import { fetchPlatforms } from "./api";
import type { Platform } from "./types";

export default function App() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selected, setSelected] = useState<Platform[]>([]);

  async function load(filters: Record<string, unknown> = {}) {
    const data = await fetchPlatforms(filters);
    setPlatforms(data);
    setSelected(data.slice(0, 6));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Comparador de Plataformas Petrobras</h1>
      <PlatformFilters onSearch={load} />
      <section style={{ marginTop: 24 }}>
        <h2>Mapa</h2>
        <PlatformMap platforms={platforms} />
      </section>
      <section style={{ marginTop: 32 }}>
        <h2>Comparativo</h2>
        <ComparisonCharts platforms={selected} />
      </section>
    </main>
  );
}
