import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip as LeafletTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchPlatforms } from "./api";
import type { Platform } from "./types";

const STATUS_LABEL: Record<string, string> = {
  operational: "Operacional",
  construction: "Em construção",
  decommissioned: "Descomissionada",
};

const num = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined || Number.isNaN(value) ? "—" : value.toLocaleString("pt-BR") + suffix;

export default function App() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [tab, setTab] = useState("comparativo");
  const [filters, setFilters] = useState({ search: "", status: "", unit_type: "", basin: "", field: "", operator: "", oil: "", gas: "", year: "", accommodation: "", sort: "oil" });

  useEffect(() => {
    fetchPlatforms()
      .then((data) => {
        setPlatforms(data);
        setSelectedIds(data.slice(0, 6).map((p) => p.id));
      })
      .catch(() => setError("Não foi possível carregar os dados da API. Recarregue em alguns instantes."))
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(() => ({
    unit_types: [...new Set(platforms.map((p) => p.unit_type).filter(Boolean))].sort(),
    basins: [...new Set(platforms.map((p) => p.basin).filter(Boolean) as string[])].sort(),
    fields: [...new Set(platforms.map((p) => p.field).filter(Boolean) as string[])].sort(),
    operators: [...new Set(platforms.map((p) => p.operator).filter(Boolean) as string[])].sort(),
  }), [platforms]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const rows = platforms.filter((p) => {
      const text = [p.name, p.field, p.basin, p.operator, p.unit_type].filter(Boolean).join(" ").toLowerCase();
      return (!q || text.includes(q))
        && (!filters.status || p.status === filters.status)
        && (!filters.unit_type || p.unit_type === filters.unit_type)
        && (!filters.basin || p.basin === filters.basin)
        && (!filters.field || p.field === filters.field)
        && (!filters.operator || p.operator === filters.operator)
        && (!filters.oil || (p.oil_bpd ?? 0) >= Number(filters.oil))
        && (!filters.gas || (p.gas_mmd ?? 0) >= Number(filters.gas))
        && (!filters.year || (p.year ?? 0) >= Number(filters.year))
        && (!filters.accommodation || (p.accommodation ?? 0) >= Number(filters.accommodation));
    });
    const key = filters.sort as keyof Platform;
    return rows.sort((a, b) => {
      if (key === "name") return a.name.localeCompare(b.name);
      return (Number(b[key] ?? 0) || 0) - (Number(a[key] ?? 0) || 0);
    });
  }, [platforms, filters]);

  const selected = useMemo(() => platforms.filter((p) => selectedIds.includes(p.id)), [platforms, selectedIds]);
  const chartData = selected.map((p) => ({ name: p.name, Óleo: p.oil_bpd ?? 0, Gás: p.gas_mmd ?? 0, BOE: p.boed ?? 0 }));
  const totals = filtered.reduce((acc, p) => ({ oil: acc.oil + (p.oil_bpd ?? 0), gas: acc.gas + (p.gas_mmd ?? 0), boe: acc.boe + (p.boed ?? 0) }), { oil: 0, gas: 0, boe: 0 });

  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((x) => x !== id) : current.length >= 6 ? [...current.slice(1), id] : [...current, id]);
  const set = (key: keyof typeof filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Comparador de Plataformas Petrobras</h1>
          <p>Compare até 6 plataformas em um único mapa interativo, com legenda, pontos coloridos, coordenadas, distância até a costa, operador, gráficos e estatísticas.</p>
        </div>
        <span className="badge">{loading ? "Carregando..." : `${platforms.length} unidades na base`}</span>
      </header>

      <section className="filters">
        <div><label>Busca</label><input value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Nome, campo, bacia ou operador" /></div>
        <div><label>Status</label><select value={filters.status} onChange={(e) => set("status", e.target.value)}><option value="">Todos</option><option value="operational">Operacional</option><option value="construction">Em construção</option><option value="decommissioned">Descomissionada</option></select></div>
        <div><label>Tipo</label><select value={filters.unit_type} onChange={(e) => set("unit_type", e.target.value)}><option value="">Todos</option>{options.unit_types.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label>Bacia</label><select value={filters.basin} onChange={(e) => set("basin", e.target.value)}><option value="">Todas</option>{options.basins.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label>Campo</label><select value={filters.field} onChange={(e) => set("field", e.target.value)}><option value="">Todos</option>{options.fields.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label>Operador</label><select value={filters.operator} onChange={(e) => set("operator", e.target.value)}><option value="">Todos</option>{options.operators.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label>Óleo mín. (bpd)</label><input type="number" value={filters.oil} onChange={(e) => set("oil", e.target.value)} /></div>
        <div><label>Gás mín. (MMm³/d)</label><input type="number" value={filters.gas} onChange={(e) => set("gas", e.target.value)} /></div>
        <div><label>Ano mín.</label><input type="number" value={filters.year} onChange={(e) => set("year", e.target.value)} /></div>
        <div><label>Acomodação mín.</label><input type="number" value={filters.accommodation} onChange={(e) => set("accommodation", e.target.value)} /></div>
        <div><label>Ordenar por</label><select value={filters.sort} onChange={(e) => set("sort", e.target.value)}><option value="oil">Óleo</option><option value="gas">Gás</option><option value="boed">BOE/d</option><option value="storage_m3">Armazenamento</option><option value="length_m">Comprimento</option><option value="weight_t">Peso</option><option value="distance_to_coast_km">Distância costa</option><option value="year">Ano</option><option value="name">Nome</option></select></div>
        <button onClick={() => setFilters({ search: "", status: "", unit_type: "", basin: "", field: "", operator: "", oil: "", gas: "", year: "", accommodation: "", sort: "oil" })}>Limpar filtros</button>
      </section>

      {loading && <div className="loading">Carregando plataformas...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="layout">
            <section className="panel">
              <div className="panel-head"><h2>Plataformas ({filtered.length})</h2><span className="pill">Selecionadas: {selected.length}/6</span></div>
              <div className="panel-body list">
                {filtered.map((p) => (
                  <article key={p.id} className={`card ${selectedIds.includes(p.id) ? "selected" : ""}`}>
                    <div className="card-top"><h4>{p.name}</h4><span className={`pill ${p.status}`}>{STATUS_LABEL[p.status] ?? p.status}</span></div>
                    <div className="meta">
                      <span>Tipo: {p.unit_type || "—"}</span><span>Bacia: {p.basin || "—"}</span>
                      <span>Campo: {p.field || "—"}</span><span>Operador: {p.operator || "—"}</span>
                      <span>Ano: {p.year || "—"}</span><span>Costa: {num(p.distance_to_coast_km, " km")}</span>
                      <span>Lat: {p.latitude ?? "—"}</span><span>Lon: {p.longitude ?? "—"}</span>
                    </div>
                    <div className="metrics">
                      <span className="metric">Óleo<b>{num(p.oil_bpd, " bpd")}</b></span>
                      <span className="metric">Gás<b>{num(p.gas_mmd, " MMm³/d")}</b></span>
                      <span className="metric">BOE<b>{num(p.boed, "/d")}</b></span>
                      <span className="metric">Acomodação<b>{num(p.accommodation)}</b></span>
                      <span className="metric">Armazenamento<b>{num(p.storage_m3, " m³")}</b></span>
                      <span className="metric">Comprimento<b>{num(p.length_m, " m")}</b></span>
                      <span className="metric">Peso<b>{num(p.weight_t, " t")}</b></span>
                    </div>
                    <button className={`select-btn ${selectedIds.includes(p.id) ? "active" : ""}`} onClick={() => toggle(p.id)}>{selectedIds.includes(p.id) ? "Remover do comparativo" : "Selecionar para comparativo"}</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head"><h2>Mapa interativo</h2><span className="pill">Leaflet • Esri Satellite</span></div>
              <MapContainer className="map" center={[-24, -42]} zoom={5} scrollWheelZoom>
                <TileLayer attribution="Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                {filtered.filter((p) => p.latitude !== null && p.longitude !== null).map((p) => (
                  <CircleMarker key={p.id} center={[p.latitude!, p.longitude!]} radius={selectedIds.includes(p.id) ? 9 : 6} pathOptions={{ color: p.status === "operational" ? "#22c55e" : p.status === "construction" ? "#f59e0b" : "#ef4444", fillColor: p.status === "operational" ? "#22c55e" : p.status === "construction" ? "#f59e0b" : "#ef4444", fillOpacity: 0.85 }}>
                    <LeafletTooltip>{p.name}</LeafletTooltip>
                    <Popup><strong>{p.name}</strong><br />{STATUS_LABEL[p.status] ?? p.status}<br />{p.unit_type}<br />Operador: {p.operator || "—"}<br />Campo: {p.field || "—"}<br />Óleo: {num(p.oil_bpd, " bpd")}<br />Gás: {num(p.gas_mmd, " MMm³/d")}</Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </section>
          </div>

          <section className="panel" style={{ marginTop: 18 }}>
            <div className="tabs">
              {["comparativo", "estatisticas", "graficos", "mapas"].map((x) => <button key={x} className={`tab ${tab === x ? "active" : ""}`} onClick={() => setTab(x)}>{x === "estatisticas" ? "Estatísticas" : x.charAt(0).toUpperCase() + x.slice(1)}</button>)}
            </div>
            <div className="panel-body">
              {tab === "comparativo" && (
                <div className="table-wrap">
                  <table className="table"><thead><tr><th>Plataforma</th><th>Status</th><th>Tipo</th><th>Bacia</th><th>Campo</th><th>Operador</th><th>Óleo</th><th>Gás</th><th>BOE/d</th><th>Ano</th><th>Acomodação</th><th>Armazenamento</th><th>Comprimento</th><th>Peso</th><th>Distância costa</th></tr></thead><tbody>
                    {selected.map((p) => <tr key={p.id}><td>{p.name}</td><td>{STATUS_LABEL[p.status] ?? p.status}</td><td>{p.unit_type}</td><td>{p.basin || "—"}</td><td>{p.field || "—"}</td><td>{p.operator || "—"}</td><td>{num(p.oil_bpd)}</td><td>{num(p.gas_mmd)}</td><td>{num(p.boed)}</td><td>{p.year || "—"}</td><td>{num(p.accommodation)}</td><td>{num(p.storage_m3)}</td><td>{num(p.length_m)}</td><td>{num(p.weight_t)}</td><td>{num(p.distance_to_coast_km)}</td></tr>)}
                  </tbody></table>
                </div>
              )}
              {tab === "estatisticas" && (
                <div className="stats">
                  <div className="stat"><span>Unidades filtradas</span><strong>{filtered.length}</strong></div>
                  <div className="stat"><span>Óleo total</span><strong>{num(totals.oil, " bpd")}</strong></div>
                  <div className="stat"><span>Gás total</span><strong>{num(totals.gas, " MMm³/d")}</strong></div>
                  <div className="stat"><span>BOE total</span><strong>{num(totals.boe, "/d")}</strong></div>
                  <div className="stat"><span>Selecionadas</span><strong>{selected.length}</strong></div>
                </div>
              )}
              {tab === "graficos" && (
                <div className="charts">
                  <h3>Produção das plataformas selecionadas</h3>
                  <ResponsiveContainer width="100%" height={420}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#22384f" /><XAxis dataKey="name" stroke="#93a7bb" /><YAxis stroke="#93a7bb" /><Tooltip /><Legend /><Bar dataKey="Óleo" fill="#38bdf8" /><Bar dataKey="Gás" fill="#22c55e" /><Bar dataKey="BOE" fill="#f59e0b" /></BarChart></ResponsiveContainer>
                </div>
              )}
              {tab === "mapas" && <p>Use os filtros à esquerda para destacar unidades no mapa satelital. Os marcadores são coloridos por status e ampliados quando selecionados.</p>}
            </div>
          </section>
        </>
      )}

      <footer className="footer">Base compilada e revisada com fontes públicas ANP, Petrobras e PPSA. Mapa usa Leaflet e imagens de satélite Esri. Distância até a costa é uma aproximação até o ponto litorâneo de referência mais próximo. Valide dados críticos antes de uso técnico. © 2026 Ricardo S. Rodrigues.</footer>
    </div>
  );
}
