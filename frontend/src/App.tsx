import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MapContainer, Marker, Popup, TileLayer, Tooltip as LeafletTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchPlatforms } from "./api";
import type { Platform } from "./types";

const STATUS_LABEL: Record<string, string> = {
  operational: "Operacional",
  construction: "Em construção",
  decommissioned: "Descomissionada",
};

const PIN_COLORS = ["#008542", "#ffcc29", "#0c2340", "#e30613", "#0072ce", "#7a28a0", "#00a878", "#f28c28", "#c2185b", "#5d4037"];
const STATUS_COLORS = ["#008542", "#ffcc29", "#e30613", "#0072ce", "#f28c28", "#7a28a0", "#00a878", "#c2185b"];
const MAX_SELECTED = 10;

const BASIN_ALIASES: Record<string, string> = {
  "campos basin": "Bacia de Campos",
  "santos basin": "Bacia de Santos",
  "espírito santo basin": "Bacia de Espírito Santo",
  "espirito santo basin": "Bacia de Espírito Santo",
  "ceará basin": "Bacia do Ceará",
  "ceara basin": "Bacia do Ceará",
};

const normalizeBasin = (name: string | null | undefined) => {
  if (!name) return name as string | null | undefined;
  const key = name.trim().toLowerCase();
  return BASIN_ALIASES[key] ?? name;
};

const num = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined || Number.isNaN(value) ? "—" : value.toLocaleString("pt-BR") + suffix;

const pinIcon = (color: string) =>
  L.divIcon({
    className: "pin-icon",
    html: `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22],
  });

export default function App() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [tab, setTab] = useState("comparativo");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [filters, setFilters] = useState({ search: "", status: "", unit_type: "", basin: "", field: "", operator: "", oil: "", gas: "", year: "", accommodation: "", sort: "oil" });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetchPlatforms()
      .then((data) => {
        setPlatforms(data.map((p) => ({ ...p, basin: normalizeBasin(p.basin) })));
        setSelectedIds([]);
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

  const withDepth = filtered.filter((p) => p.water_depth_m != null);
  const avgDepth = withDepth.length ? withDepth.reduce((s, p) => s + (p.water_depth_m ?? 0), 0) / withDepth.length : 0;
  const maxDepth = withDepth.length ? Math.max(...withDepth.map((p) => p.water_depth_m ?? 0)) : 0;
  const totalAccommodation = filtered.reduce((s, p) => s + (p.accommodation ?? 0), 0);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((p) => { const k = STATUS_LABEL[p.status] ?? p.status; map[k] = (map[k] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const basinData = useMemo(() => {
    const map: Record<string, { count: number; oil: number }> = {};
    filtered.forEach((p) => { const k = p.basin || "Não informado"; if (!map[k]) map[k] = { count: 0, oil: 0 }; map[k].count++; map[k].oil += p.oil_bpd ?? 0; });
    return Object.entries(map).map(([name, v]) => ({ name, Unidades: v.count, Óleo: v.oil })).sort((a, b) => b.Unidades - a.Unidades).slice(0, 6);
  }, [filtered]);

  const operatorData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((p) => { const k = p.operator || "Não informado"; map[k] = (map[k] ?? 0) + (p.oil_bpd ?? 0); });
    return Object.entries(map).map(([name, Óleo]) => ({ name, Óleo })).sort((a, b) => b.Óleo - a.Óleo).slice(0, 6);
  }, [filtered]);

  const typeData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((p) => { const k = p.unit_type || "Não informado"; map[k] = (map[k] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const selStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    selected.forEach((p) => { const k = STATUS_LABEL[p.status] ?? p.status; map[k] = (map[k] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [selected]);

  const selBasinData = useMemo(() => {
    const map: Record<string, number> = {};
    selected.forEach((p) => { const k = p.basin || "Não informado"; map[k] = (map[k] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [selected]);

  const selOperatorData = useMemo(() => {
    const map: Record<string, number> = {};
    selected.forEach((p) => { const k = p.operator || "Não informado"; map[k] = (map[k] ?? 0) + (p.oil_bpd ?? 0); });
    return Object.entries(map).map(([name, Óleo]) => ({ name, Óleo })).sort((a, b) => b.Óleo - a.Óleo);
  }, [selected]);

  const selTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    selected.forEach((p) => { const k = p.unit_type || "Não informado"; map[k] = (map[k] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [selected]);

  const topOil = useMemo(() => [...filtered].filter((p) => (p.oil_bpd ?? 0) > 0).sort((a, b) => (b.oil_bpd ?? 0) - (a.oil_bpd ?? 0)).slice(0, 5), [filtered]);
  const topDepth = useMemo(() => [...filtered].filter((p) => p.water_depth_m != null).sort((a, b) => (b.water_depth_m ?? 0) - (a.water_depth_m ?? 0)).slice(0, 5), [filtered]);

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else if (selectedIds.length >= MAX_SELECTED) {
      window.alert("Você já atingiu o limite de 10 plataformas selecionadas. Remova uma antes de selecionar outra.");
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };
  const set = (key: keyof typeof filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const pinColor = (id: number) => PIN_COLORS[selected.findIndex((s) => s.id === id) % PIN_COLORS.length];

  const isDark = theme === "dark";
  const kpiStyle: React.CSSProperties = { background: "linear-gradient(135deg,#0c2340 0%,#123a5c 100%)", borderRadius: 12, padding: "14px 18px", color: "#fff", minWidth: 150, flex: 1 };
  const kpiLabel: React.CSSProperties = { fontSize: 12, opacity: 0.75, display: "block", marginBottom: 4 };
  const kpiValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, display: "block" };
  const chartBoxStyle: React.CSSProperties = { background: isDark ? "#0f2740" : "#f4f6f8", borderRadius: 12, padding: 16, flex: 1, minWidth: 320 };
  const rankBoxStyle: React.CSSProperties = { background: isDark ? "#0f2740" : "#f4f6f8", borderRadius: 12, padding: 16, flex: 1, minWidth: 280 };
  const chartTitleStyle: React.CSSProperties = { marginTop: 0, color: isDark ? "#fff" : "#0c2340" };
  const gridColor = isDark ? "#22384f" : "#d9e2ea";
  const axisColor = isDark ? "#93a7bb" : "#5b6b7b";
  const rankTextStyle: React.CSSProperties = { color: isDark ? "#cfe0f0" : "#1c2b3a", paddingLeft: 20, margin: 0 };
  const rankStrongColor = isDark ? "#fff" : "#0c2340";

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Comparador de Plataformas Petrobras</h1>
          <p>Selecione até 10 unidades para comparar no mapa, cada uma com um pin de cor própria.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "🌙 Escuro" : "☀️ Claro"}
          </button>
          <span className="badge">{loading ? "Carregando..." : `${platforms.length} unidades na base`}</span>
        </div>
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
              <div className="panel-head">
                <h2>Plataformas ({filtered.length})</h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="pill">Selecionadas: {selected.length}/10</span>
                  <button className="clear-btn" onClick={() => setSelectedIds([])}>Limpar seleção</button>
                </div>
              </div>
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
              <div className="panel-head"><h2>Mapa — unidades selecionadas</h2><span className="pill">{selected.length}/10 no mapa</span></div>
              <MapContainer className="map" center={[-24, -42]} zoom={5} scrollWheelZoom>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {selected.filter((p) => p.latitude !== null && p.longitude !== null).map((p) => {
                  const color = pinColor(p.id);
                  return (
                    <Marker key={p.id} position={[p.latitude!, p.longitude!]} icon={pinIcon(color)}>
                      <LeafletTooltip>{p.name}</LeafletTooltip>
                      <Popup><strong>{p.name}</strong><br />{STATUS_LABEL[p.status] ?? p.status}<br />{p.unit_type}<br />Operador: {p.operator || "—"}<br />Campo: {p.field || "—"}<br />Óleo: {num(p.oil_bpd, " bpd")}<br />Gás: {num(p.gas_mmd, " MMm³/d")}</Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
              <div className="map-legend">
                <strong>Legenda:</strong>
                {selected.length === 0 && <span className="legend-item">Nenhuma unidade selecionada</span>}
                {selected.map((p) => (
                  <span key={p.id} className="legend-item">
                    <span className="legend-dot" style={{ background: pinColor(p.id) }}></span>
                    {p.name}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <section className="panel" style={{ marginTop: 18 }}>
            <div className="tabs">
              {["comparativo", "estatisticas", "graficos"].map((x) => <button key={x} className={`tab ${tab === x ? "active" : ""}`} onClick={() => setTab(x)}>{x === "estatisticas" ? "Estatísticas" : x.charAt(0).toUpperCase() + x.slice(1)}</button>)}
            </div>
            <div className="panel-body">
              {tab === "comparativo" && (
                <div className="table-wrap">
                  <table className="table"><thead><tr><th>Plataforma</th><th>Status</th><th>Tipo</th><th>Bacia</th><th>Campo</th><th>Operador</th><th>Óleo</th><th>Gás (MMm³/d)</th><th>BOE/d</th><th>Ano</th><th>Acomodação</th><th>Armazenamento</th><th>Comprimento</th><th>Peso</th><th>Distância costa (km)</th></tr></thead><tbody>
                    {selected.map((p) => <tr key={p.id}><td>{p.name}</td><td>{STATUS_LABEL[p.status] ?? p.status}</td><td>{p.unit_type}</td><td>{p.basin || "—"}</td><td>{p.field || "—"}</td><td>{p.operator || "—"}</td><td>{num(p.oil_bpd)}</td><td>{num(p.gas_mmd, " MMm³/d")}</td><td>{num(p.boed)}</td><td>{p.year || "—"}</td><td>{num(p.accommodation)}</td><td>{num(p.storage_m3)}</td><td>{num(p.length_m)}</td><td>{num(p.weight_t)}</td><td>{num(p.distance_to_coast_km, " km")}</td></tr>)}
                  </tbody></table>
                </div>
              )}
              {tab === "estatisticas" && (
                <div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                    <div style={kpiStyle}><span style={kpiLabel}>Unidades filtradas</span><strong style={kpiValue}>{filtered.length}</strong><span style={{ fontSize: 11, opacity: 0.6 }}>{platforms.length} na base total</span></div>
                    <div style={kpiStyle}><span style={kpiLabel}>Óleo total</span><strong style={kpiValue}>{num(totals.oil, " bpd")}</strong></div>
                    <div style={kpiStyle}><span style={kpiLabel}>Gás total</span><strong style={kpiValue}>{num(totals.gas, " MMm³/d")}</strong></div>
                    <div style={kpiStyle}><span style={kpiLabel}>BOE total</span><strong style={kpiValue}>{num(totals.boe, "/d")}</strong></div>
                    <div style={kpiStyle}><span style={kpiLabel}>Profundidade média</span><strong style={kpiValue}>{num(Math.round(avgDepth), " m")}</strong><span style={{ fontSize: 11, opacity: 0.6 }}>máx: {num(maxDepth, " m")}</span></div>
                    <div style={kpiStyle}><span style={kpiLabel}>Acomodação total</span><strong style={kpiValue}>{num(totalAccommodation)}</strong><span style={{ fontSize: 11, opacity: 0.6 }}>pessoas</span></div>
                  </div>

                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
                    <div style={chartBoxStyle}>
                      <h4 style={chartTitleStyle}>Distribuição por status</h4>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                            {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                          </Pie>
                          <Tooltip /><Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={chartBoxStyle}>
                      <h4 style={chartTitleStyle}>Top bacias por nº de unidades</h4>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={basinData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                          <YAxis stroke={axisColor} />
                          <Tooltip /><Legend />
                          <Bar dataKey="Unidades" fill="#008542" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
                    <div style={chartBoxStyle}>
                      <h4 style={chartTitleStyle}>Top operadores por produção de óleo (bpd)</h4>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={operatorData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis type="number" stroke={axisColor} />
                          <YAxis type="category" dataKey="name" stroke={axisColor} width={140} fontSize={11} />
                          <Tooltip /><Legend />
                          <Bar dataKey="Óleo" fill="#0072ce" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={chartBoxStyle}>
                      <h4 style={chartTitleStyle}>Distribuição por tipo de unidade</h4>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={typeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                          <YAxis stroke={axisColor} />
                          <Tooltip /><Legend />
                          <Bar dataKey="value" name="Unidades" fill="#ffcc29" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div style={rankBoxStyle}>
                      <h4 style={chartTitleStyle}>Top 5 produtores de óleo</h4>
                      <ol style={rankTextStyle}>
                        {topOil.map((p) => <li key={p.id} style={{ marginBottom: 6 }}><strong style={{ color: rankStrongColor }}>{p.name}</strong> — {num(p.oil_bpd, " bpd")}</li>)}
                        {topOil.length === 0 && <li>Nenhuma unidade com produção de óleo nos filtros atuais.</li>}
                      </ol>
                    </div>
                    <div style={rankBoxStyle}>
                      <h4 style={chartTitleStyle}>Top 5 por profundidade</h4>
                      <ol style={rankTextStyle}>
                        {topDepth.map((p) => <li key={p.id} style={{ marginBottom: 6 }}><strong style={{ color: rankStrongColor }}>{p.name}</strong> — {num(p.water_depth_m, " m")}</li>)}
                        {topDepth.length === 0 && <li>Nenhuma unidade com profundidade informada nos filtros atuais.</li>}
                      </ol>
                    </div>
                  </div>
                </div>
              )}
              {tab === "graficos" && (
                <div className="charts">
                  <h3>Comparação das plataformas selecionadas ({selected.length}/10)</h3>
                  {selected.length === 0 && <p style={{ color: axisColor }}>Selecione plataformas na lista à esquerda para ver os gráficos comparativos.</p>}
                  {selected.length > 0 && (
                    <>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
                        <div style={chartBoxStyle}>
                          <h4 style={chartTitleStyle}>Produção de Óleo e BOE</h4>
                          <ResponsiveContainer width="100%" height={360}>
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                              <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                              <YAxis stroke={axisColor} />
                              <Tooltip /><Legend />
                              <Bar dataKey="Óleo" fill="#008542" />
                              <Bar dataKey="BOE" fill="#ffcc29" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={chartBoxStyle}>
                          <h4 style={chartTitleStyle}>Produção de Gás</h4>
                          <ResponsiveContainer width="100%" height={360}>
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                              <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                              <YAxis stroke={axisColor} />
                              <Tooltip /><Legend />
                              <Bar dataKey="Gás" fill="#f28c28" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 24 }}>
                        <div style={chartBoxStyle}>
                          <h4 style={chartTitleStyle}>Status das selecionadas</h4>
                          <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                              <Pie data={selStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                                {selStatusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                              </Pie>
                              <Tooltip /><Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={chartBoxStyle}>
                          <h4 style={chartTitleStyle}>Bacias das selecionadas</h4>
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={selBasinData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                              <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                              <YAxis stroke={axisColor} />
                              <Tooltip /><Legend />
                              <Bar dataKey="value" name="Unidades" fill="#008542" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 24 }}>
                        <div style={chartBoxStyle}>
                          <h4 style={chartTitleStyle}>Operadores das selecionadas (óleo bpd)</h4>
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={selOperatorData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                              <XAxis type="number" stroke={axisColor} />
                              <YAxis type="category" dataKey="name" stroke={axisColor} width={140} fontSize={11} />
                              <Tooltip /><Legend />
                              <Bar dataKey="Óleo" fill="#0072ce" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={chartBoxStyle}>
                          <h4 style={chartTitleStyle}>Tipos de unidade selecionadas</h4>
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={selTypeData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                              <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                              <YAxis stroke={axisColor} />
                              <Tooltip /><Legend />
                              <Bar dataKey="value" name="Unidades" fill="#ffcc29" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <footer className="footer">Base compilada e revisada com fontes públicas ANP, Petrobras e PPSA. Mapa usa Leaflet e OpenStreetMap. Distância até a costa é uma aproximação até o ponto litorâneo de referência mais próximo. Valide dados críticos antes de uso técnico. © 2026 Ricardo S. Rodrigues.</footer>
    </div>
  );
}