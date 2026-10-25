import { useEffect, useMemo, useState } from "react";
import { useMap } from "react-leaflet";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { MapContainer, Marker, Popup, TileLayer, Tooltip as LeafletTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchPlatforms, fetchOnshore, fetchRefinarias, fetchTerminaisArmazenamento, fetchUtgnsGas, fetchEcompsGasbol, fetchProducaoHistorica } from "./api";
import { fetchProducaoHistorica } from "./api/producao";
import { POB_OVERRIDES } from "./pob-overrides";
import type { Platform } from "./types";
import onshoreData from "./data/onshore.json";
import refinariasData from "./data/refinarias.json";
import terminaisArmazenamentoData from "./data/terminais-armazenamento.json";
import utgnsGasData from "./data/utgns-gas.json";
import ecompsGasbolData from "./data/ecomps-gasbol.json";

const STATUS_LABEL: Record<string, string> = {
  operational: "Operacional",
  construction: "Em construção",
  decommissioned: "Descomissionada",
};

const PIN_COLORS = ["#008542", "#ffcc29", "#0c2340", "#e30613", "#0072ce", "#7a28a0", "#00a878", "#f28c28", "#c2185b", "#5d4037"];
const SERIE_COLORS = ["#4ade80", "#fbbf24", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#22d3ee", "#f87171", "#a3e635", "#e879f9"];
const STATUS_COLORS = ["#008542", "#ffcc29", "#e30613", "#0072ce", "#f28c28", "#7a28a0", "#00a878", "#c2185b"];
const MAX_SELECTED = 10;

const TOOLTIP_UNIT_MAP: Record<string, string> = {
  "Óleo": " bpd",
  "Gás": " MMm³/d",
  "BOE": " /d",
  "Poços": "",
  "Armazenamento": " m³",
  "Campos": "",
  "BOE/poço": " /d por poço",
  "Óleo/acomodação": " bpd por pessoa",
  "Óleo (bpd)": " bpd",
  "Gás (Mm³/dia)": " Mm³/dia",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#0c2340", border: "1px solid #2a4a6b", borderRadius: 8, padding: "10px 14px", boxShadow: "0 4px 14px rgba(0,0,0,.35)", maxWidth: 260 }}>
      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13, color: "#ffffff", lineHeight: 1.3 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ margin: "4px 0", fontSize: 12, color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: entry.color || entry.stroke || entry.fill, display: "inline-block", flexShrink: 0 }}></span>
          <span style={{ color: "#ffffff" }}>{entry.name}: <strong style={{ color: "#ffcc29" }}>{Number(entry.value).toLocaleString("pt-BR")}{TOOLTIP_UNIT_MAP[entry.name] ?? ""}</strong></span>
        </p>
      ))}
    </div>
  );
};

const CustomScatterTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#0c2340", border: "1px solid #2a4a6b", borderRadius: 8, padding: "10px 14px", boxShadow: "0 4px 14px rgba(0,0,0,.35)", maxWidth: 260 }}>
      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13, color: "#ffffff", lineHeight: 1.3 }}>{d.name}</p>
      <p style={{ margin: "4px 0", fontSize: 12, color: "#ffffff" }}>Óleo: <strong style={{ color: "#ffcc29" }}>{Number(d.x).toLocaleString("pt-BR")} bpd</strong></p>
      <p style={{ margin: "4px 0", fontSize: 12, color: "#ffffff" }}>Gás: <strong style={{ color: "#ffcc29" }}>{Number(d.y).toLocaleString("pt-BR")} MMm³/d</strong></p>
      <p style={{ margin: "4px 0", fontSize: 12, color: "#ffffff" }}>BOE: <strong style={{ color: "#ffcc29" }}>{Number(d.z).toLocaleString("pt-BR")} /d</strong></p>
    </div>
  );
};

function DensityHeatmap({ points, visible }: { points: { lat: number; lng: number; density: number }[]; visible: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!visible || !points.length) return;
    const group = L.layerGroup(
      points.map((pt) => {
        const intensity = Math.min(pt.density / 8, 1);
        const color = intensity > 0.66 ? "#e30613" : intensity > 0.33 ? "#ffcc29" : "#008542";
        return L.circle([pt.lat, pt.lng], {
          radius: 30000 + intensity * 70000,
          color: "transparent",
          fillColor: color,
          fillOpacity: 0.2 + intensity * 0.3,
          weight: 0,
        });
      })
    ).addTo(map);
    return () => { map.removeLayer(group); };
  }, [map, points, visible]);
  return null;
}

type Modality = "maritimas" | "terrestres" | "refinarias";

const MODALITY_OPTIONS: [Modality, string][] = [
  ["maritimas", "Marítimas"],
  ["terrestres", "Terrestres"],
  ["refinarias", "Refino, Gás e Logística"],
];

const SORT_KEY_MAP: Record<string, keyof Platform> = {
  oil: "oil_bpd",
  gas: "gas_mmd",
  boed: "boed",
};

const BASIN_ALIASES: Record<string, string> = {
  "campos basin": "Bacia de Campos",
  "santos basin": "Bacia de Santos",
  "espírito santo basin": "Bacia de Espírito Santo",
  "espirito santo basin": "Bacia de Espírito Santo",
  "ceará basin": "Bacia do Ceará",
  "ceara basin": "Bacia do Ceará",
  "recôncavo basin": "Bacia do Recôncavo",
  "reconcavo basin": "Bacia do Recôncavo",
  "potiguar basin": "Bacia Potiguar",
  "sergipe-alagoas basin": "Bacia de Sergipe-Alagoas",
  "sergipe basin": "Bacia de Sergipe",
  "alagoas basin": "Bacia de Alagoas",
  "solimões basin": "Bacia do Solimões",
  "solimoes basin": "Bacia do Solimões",
  "amazonas basin": "Bacia do Amazonas",
  "parnaíba basin": "Bacia do Parnaíba",
  "parnaiba basin": "Bacia do Parnaíba",
  "paraná basin": "Bacia do Paraná",
  "parana basin": "Bacia do Paraná",
  "pelotas basin": "Bacia de Pelotas",
  "foz do amazonas basin": "Bacia de Foz do Amazonas",
  "jequitinhonha basin": "Bacia de Jequitinhonha",
  "cumuruxatiba basin": "Bacia de Cumuruxatiba",
  "camamu-almada basin": "Bacia do Camamu-Almada",
  "jacuípe basin": "Bacia do Jacuípe",
  "jacuipe basin": "Bacia do Jacuípe",
  "barreirinhas basin": "Bacia de Barreirinhas",
  "para-maranhão basin": "Bacia Para-Maranhão",
  "para-maranhao basin": "Bacia Para-Maranhão",
  "são francisco basin": "Bacia do São Francisco",
  "sao francisco basin": "Bacia do São Francisco",
  "parecis basin": "Bacia dos Parecis",
  "parecís basin": "Bacia dos Parecis",
  "tacutu basin": "Bacia do Tacutu",
  "acre basin": "Bacia do Acre",
  "madre de dios basin": "Bacia Madre de Dios",
  "beni basin": "Bacia do Beni",
  "taubaté basin": "Bacia do Taubaté",
  "taubate basin": "Bacia do Taubate",
  "são paulo basin": "Bacia do São Paulo",
  "sao paulo basin": "Bacia do São Paulo",
  "curitiba basin": "Bacia de Curitiba",
  "candiota basin": "Bacia de Candiota",
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
  const [modality, setModality] = useState<Modality>("maritimas");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", unit_type: "", basin: "", field: "", operator: "", state: "", municipality: "", oil: "", gas: "", year: "", accommodation: "", wells: "", storage: "", sort: "oil" });
  const [serieData, setSerieData] = useState<any[]>([]);
  const [serieCampos, setSerieCampos] = useState<string[]>([]);
  const [serieStatus, setSerieStatus] = useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [serieErro, setSerieErro] = useState("");

  const [onshoreUnits, setOnshoreUnits] = useState<Platform[]>(onshoreData as unknown as Platform[]);
  const [refinariasUnits, setRefinariasUnits] = useState<Platform[]>(refinariasData as unknown as Platform[]);
  const [terminaisArmazenamentoUnits, setTerminaisArmazenamentoUnits] = useState<Platform[]>(terminaisArmazenamentoData as unknown as Platform[]);
  const [utgnsGasUnits, setUtgnsGasUnits] = useState<Platform[]>(utgnsGasData as unknown as Platform[]);
  const [ecompsGasbolUnits, setEcompsGasbolUnits] = useState<Platform[]>(ecompsGasbolData as unknown as Platform[]);
  const activeUnits = modality === "maritimas" ? platforms : modality === "terrestres" ? onshoreUnits : [...refinariasUnits, ...terminaisArmazenamentoUnits, ...utgnsGasUnits, ...ecompsGasbolUnits];
  const isOnshore = modality === "terrestres";
  const isOffshore = modality === "maritimas";
  const isRefino = modality === "refinarias";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mod = params.get("mod");
    const sel = params.get("sel");
    if (mod && ["maritimas", "terrestres", "refinarias"].includes(mod)) setModality(mod as Modality);
    if (sel) {
      const ids = sel.split(",").map(Number).filter((n) => !Number.isNaN(n));
      setSelectedIds(ids);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms()
      .then((data) => {
        setPlatforms(data.map((p) => ({ 
          ...p, 
          basin: normalizeBasin(p.basin),
          accommodation: POB_OVERRIDES[p.slug] ?? p.accommodation 
        })));
      })
      .catch(() => setError("Não foi possível carregar os dados da API. Recarregue em alguns instantes."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOnshore().then((data) => setOnshoreUnits(data)).catch(() => {});
    fetchRefinarias().then((data) => setRefinariasUnits(data)).catch(() => {});
    fetchTerminaisArmazenamento().then((data) => setTerminaisArmazenamentoUnits(data)).catch(() => {});
    fetchUtgnsGas().then((data) => setUtgnsGasUnits(data)).catch(() => {});
    fetchEcompsGasbol().then((data) => setEcompsGasbolUnits(data)).catch(() => {});
  }, []);

  const options = useMemo(() => ({
    unit_types: [...new Set(activeUnits.map((p) => p.unit_type).filter(Boolean))].sort(),
    basins: [...new Set(activeUnits.map((p) => p.basin).filter(Boolean) as string[])].sort(),
    fields: [...new Set(activeUnits.map((p) => p.field).filter(Boolean) as string[])].sort(),
    operators: [...new Set(activeUnits.map((p) => p.operator).filter(Boolean) as string[])].sort(),
    states: [...new Set(activeUnits.map((p) => (p as any).state).filter(Boolean) as string[])].sort(),
    municipalities: [...new Set(activeUnits.map((p) => (p as any).municipality).filter(Boolean) as string[])].sort(),
  }), [activeUnits]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const rows = activeUnits.filter((p) => {
      const text = [p.name, p.field, p.basin, p.operator, p.unit_type, (p as any).state, (p as any).municipality].filter(Boolean).join(" ").toLowerCase();
      return (!q || text.includes(q))
        && (!filters.status || p.status === filters.status)
        && (!filters.unit_type || p.unit_type === filters.unit_type)
        && (!filters.basin || p.basin === filters.basin)
        && (!filters.field || p.field === filters.field)
        && (!filters.operator || p.operator === filters.operator)
        && (!filters.state || (p as any).state === filters.state)
        && (!filters.municipality || (p as any).municipality === filters.municipality)
        && (!filters.oil || (p.oil_bpd ?? 0) >= Number(filters.oil))
        && (!filters.gas || (p.gas_mmd ?? 0) >= Number(filters.gas))
        && (!filters.year || (p.year ?? 0) >= Number(filters.year))
        && (!filters.accommodation || (p.accommodation ?? 0) >= Number(filters.accommodation))
        && (!filters.wells || ((p as any).wells_productive ?? 0) >= Number(filters.wells))
        && (!filters.storage || (p.storage_m3 ?? 0) >= Number(filters.storage));
    });
    const key = SORT_KEY_MAP[filters.sort] ?? (filters.sort as keyof Platform);
    return rows.sort((a, b) => {
      if (key === "name") return a.name.localeCompare(b.name);
      return (Number(b[key] ?? 0) || 0) - (Number(a[key] ?? 0) || 0);
    });
  }, [activeUnits, filters]);

  const densityPoints = useMemo(() => {
    const pts = filtered.filter((p) => p.latitude != null && p.longitude != null);
    return pts.map((p) => {
      const nearby = pts.filter((q) => {
        const dLat = (q.latitude! - p.latitude!) * 111;
        const dLon = (q.longitude! - p.longitude!) * 111 * Math.cos((p.latitude! * Math.PI) / 180);
        return Math.sqrt(dLat * dLat + dLon * dLon) < 150;
      }).length;
      return { lat: p.latitude!, lng: p.longitude!, density: nearby };
    });
  }, [filtered]);

  const selected = useMemo(() => activeUnits.filter((p) => selectedIds.includes(p.id)), [activeUnits, selectedIds]);
  const chartData = selected.map((p) => {
    const poloRef = isOnshore ? (p as any).producao_polo_gas_mmd : null;
    return {
      name: poloRef != null ? `${p.name} (polo)` : p.name,
      Óleo: p.oil_bpd ?? 0,
      Gás: poloRef != null ? poloRef : (p.gas_mmd ?? 0),
      BOE: p.boed ?? 0,
      Poços: (p as any).wells_productive ?? 0,
      Armazenamento: p.storage_m3 ?? 0,
    };
  });

  const scatterData = selected.map((p, i) => {
    const poloRef = isOnshore ? (p as any).producao_polo_gas_mmd : null;
    return {
      x: p.oil_bpd ?? 0,
      y: poloRef != null ? poloRef : (p.gas_mmd ?? 0),
      z: p.boed ?? 0,
      name: poloRef != null ? `${p.name} (polo)` : p.name,
      fill: PIN_COLORS[i % PIN_COLORS.length],
    };
  });

  const efficiencyData = selected.map((p) => {
    const wells = (p as any).wells_productive ?? 0;
    const accommodation = p.accommodation ?? 0;
    return {
      name: p.name,
      "BOE/poço": isOnshore && wells > 0 ? Math.round((p.boed ?? 0) / wells) : 0,
      "Óleo/acomodação": isOffshore && accommodation > 0 ? Math.round((p.oil_bpd ?? 0) / accommodation) : 0,
    };
  });

  const radarData = useMemo(() => {
    if (selected.length === 0) return [];
    const metrics = ["Óleo", "Gás", "BOE"] as const;
    const getMax = (m: string) => Math.max(...selected.map((p) => m === "Óleo" ? (p.oil_bpd ?? 0) : m === "Gás" ? (p.gas_mmd ?? 0) : (p.boed ?? 0)), 1);
    return metrics.map((m) => {
      const entry: any = { metric: m };
      selected.forEach((p) => {
        const val = m === "Óleo" ? (p.oil_bpd ?? 0) : m === "Gás" ? (p.gas_mmd ?? 0) : (p.boed ?? 0);
        entry[p.name] = Math.round((val / getMax(m)) * 100);
      });
      return entry;
    });
  }, [selected]);

  const totals = filtered.reduce((acc, p) => ({ oil: acc.oil + (p.oil_bpd ?? 0), gas: acc.gas + (p.gas_mmd ?? 0), boe: acc.boe + (p.boed ?? 0), wells: acc.wells + ((p as any).wells_productive ?? 0), storage: acc.storage + (p.storage_m3 ?? 0) }), { oil: 0, gas: 0, boe: 0, wells: 0, storage: 0 });

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
    filtered.forEach((p) => { const k = p.basin || (p as any).state || "Não informado"; if (!map[k]) map[k] = { count: 0, oil: 0 }; map[k].count++; map[k].oil += p.oil_bpd ?? 0; });
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

  const poloData = useMemo(() => {
    const map: Record<string, { count: number; oil: number; gas: number; boe: number; wells: number }> = {};
    filtered.forEach((p) => {
      const k = (p as any).polo || p.name;
      if (!map[k]) map[k] = { count: 0, oil: 0, gas: 0, boe: 0, wells: 0 };
      map[k].count++;
      map[k].oil += p.oil_bpd ?? 0;
      map[k].gas += p.gas_mmd ?? 0;
      map[k].boe += p.boed ?? 0;
      map[k].wells += (p as any).wells_productive ?? 0;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [filtered]);

  const topOil = useMemo(() => [...filtered].filter((p) => (p.oil_bpd ?? 0) > 0).sort((a, b) => (b.oil_bpd ?? 0) - (a.oil_bpd ?? 0)).slice(0, 5), [filtered]);
  const topDepth = useMemo(() => [...filtered].filter((p) => p.water_depth_m != null).sort((a, b) => (b.water_depth_m ?? 0) - (a.water_depth_m ?? 0)).slice(0, 5), [filtered]);
  const topStorage = useMemo(() => [...filtered].filter((p) => (p.storage_m3 ?? 0) > 0).sort((a, b) => (b.storage_m3 ?? 0) - (a.storage_m3 ?? 0)).slice(0, 5), [filtered]);

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
  const resetFilters = () => setFilters({ search: "", status: "", unit_type: "", basin: "", field: "", operator: "", state: "", municipality: "", oil: "", gas: "", year: "", accommodation: "", wells: "", storage: "", sort: "oil" });
  const pinColor = (id: number) => PIN_COLORS[selected.findIndex((s) => s.id === id) % PIN_COLORS.length];

  const carregarSerie = async () => {
    if (isRefino) {
      window.location.href = "/temporal.html";
      return;
    }
    const campos = [...new Set(selected.map((p) => p.field).filter(Boolean) as string[])];
    if (campos.length === 0) { window.alert("Nenhuma unidade selecionada possui campo informado."); return; }
    setSerieStatus("loading");
    setSerieErro("");
    setSerieData([]);
    setSerieCampos([]);
    try {
      const resultados = await Promise.all(
        campos.map((campo) =>
          fetchProducaoHistorica(campo, 36)
            .then((raw) => ({ campo, dados: raw.dados || [] }))
            .catch(() => ({ campo, dados: [] }))
        )
      );
      const mapa: Record<string, any[]> = {};
      resultados.forEach(({ campo, dados }) => { if (dados.length > 0) mapa[campo] = dados; });
      const camposComDados = Object.keys(mapa);
      if (camposComDados.length === 0) {
        setSerieStatus("erro");
        setSerieErro("Nenhum dos campos selecionados retornou dados históricos.");
        return;
      }
      const periodos = new Set<string>();
      camposComDados.forEach((c) => (mapa[c] || []).forEach((r: any) => { if (r?.periodo) periodos.add(String(r.periodo)); }));
      const consolidada = Array.from(periodos).sort().map((periodo) => {
        const entry: any = { periodo };
        camposComDados.forEach((campo) => {
          const row = (mapa[campo] || []).find((r: any) => String(r?.periodo) === periodo);
          if (row) {
            entry[`oleo_${campo}`] = row.oleo_bpd;
            entry[`gas_${campo}`] = row.gas_mmd;
          }
        });
        return entry;
      });
      setSerieData(consolidada);
      setSerieCampos(camposComDados);
      setSerieStatus("ok");
    } catch (e: any) {
      setSerieErro(e?.message || "Erro desconhecido");
      setSerieStatus("erro");
    }
  };

  const exportCSV = () => {
    if (selected.length === 0) { window.alert("Selecione pelo menos uma unidade para exportar."); return; }
    const headers = ["Unidade", "Status", "Tipo", ...(isRefino ? ["Estado", "Município"] : ["Bacia", "Campo"]), "Operador", "Óleo (bpd)", "Gás (MMm³/d)", "BOE/d", "Ano", ...(isOffshore ? ["Acomodação", "Armazenamento (m³)", "Comprimento (m)", "Peso (t)", "Distância costa (km)"] : []), ...(isOnshore ? ["Poços produtivos"] : []), ...(isRefino ? ["Armazenamento (m³)"] : [])];
    const rows = selected.map((p) => [
      p.name,
      STATUS_LABEL[p.status] ?? p.status,
      p.unit_type ?? "",
      ...(isRefino ? [(p as any).state ?? "", (p as any).municipality ?? ""] : [p.basin ?? "", p.field ?? ""]),
      p.operator ?? "",
      p.oil_bpd ?? "",
      p.gas_mmd ?? "",
      p.boed ?? "",
      p.year ?? "",
      ...(isOffshore ? [p.accommodation ?? "", p.storage_m3 ?? "", p.length_m ?? "", p.weight_t ?? "", p.distance_to_coast_km ?? ""] : []),
      ...(isOnshore ? [(p as any).wells_productive ?? ""] : []),
      ...(isRefino ? [p.storage_m3 ?? ""] : []),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparativo_unidades_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareUrl = () => {
    const params = new URLSearchParams();
    if (selectedIds.length) params.set("sel", selectedIds.join(","));
    if (modality !== "maritimas") params.set("mod", modality);
    const qs = params.toString();
    const url = `${window.location.origin}${window.location.pathname}${qs ? "?" + qs : ""}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => window.alert("Link copiado para a área de transferência!")).catch(() => window.prompt("Copie o link abaixo:", url));
    } else {
      window.prompt("Copie o link abaixo:", url);
    }
  };

  const isDark = theme === "dark";
  const kpiStyle: React.CSSProperties = { background: "linear-gradient(135deg,#0c2340 0%,#123a5c 100%)", borderRadius: 12, padding: "14px 18px", color: "#fff", minWidth: 150, flex: 1 };
  const kpiLabel: React.CSSProperties = { fontSize: 12, opacity: 0.75, display: "block", marginBottom: 4 };
  const kpiValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, display: "block" };
  const chartBoxStyle: React.CSSProperties = { background: isDark ? "#0f2740" : "#f4f6f8", borderRadius: 12, padding: 16, flex: isMobile ? "1 1 100%" : "1 1 320px", minWidth: 0, width: isMobile ? "100%" : "auto" };
  const rankBoxStyle: React.CSSProperties = { background: isDark ? "#0f2740" : "#f4f6f8", borderRadius: 12, padding: 16, flex: 1, minWidth: 280 };
  const chartTitleStyle: React.CSSProperties = { marginTop: 0, color: isDark ? "#fff" : "#0c2340" };
  const gridColor = isDark ? "#22384f" : "#d9e2ea";
  const axisColor = isDark ? "#93a7bb" : "#5b6b7b";
  const rankTextStyle: React.CSSProperties = { color: isDark ? "#cfe0f0" : "#1c2b3a", paddingLeft: 20, margin: 0 };
  const rankStrongColor = isDark ? "#fff" : "#0c2340";
  const chartRowStyle: React.CSSProperties = { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24, flexDirection: isMobile ? "column" : "row" };
  const actionBtnStyle: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #2a4a6b", background: isDark ? "#123a5c" : "#e8eef4", color: isDark ? "#fff" : "#0c2340", fontSize: 13, cursor: "pointer", transition: "all .2s" };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Comparador de Unidades Petrobrás</h1>
          <p>Selecione até 10 unidades para comparar no mapa, cada uma com um pin de cor própria.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, background: isDark ? "#0f2740" : "#e8eef4", padding: 4, borderRadius: 10 }}>
            {MODALITY_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => { setModality(value); setSelectedIds([]); resetFilters(); }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: modality === value ? "#008542" : "transparent",
                  color: modality === value ? "#fff" : (isDark ? "#93a7bb" : "#5b6b7b"),
                  fontSize: 13,
                  fontWeight: modality === value ? 600 : 400,
                  cursor: "pointer",
                  transition: "all .2s"
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "🌙 Escuro" : "☀️ Claro"}
          </button>
          <span className="badge">{loading ? "Carregando..." : `${activeUnits.length} unidades na base`}</span>
        </div>
      </header>

      <section className="filters">
        <div><label htmlFor="f-search">Busca</label><input id="f-search" value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Nome, campo, bacia ou operador" /></div>
        <div><label htmlFor="f-status">Status</label><select id="f-status" value={filters.status} onChange={(e) => set("status", e.target.value)}><option value="">Todos</option><option value="operational">Operacional</option><option value="construction">Em construção</option><option value="decommissioned">Descomissionada</option></select></div>
        <div><label htmlFor="f-type">Tipo</label><select id="f-type" value={filters.unit_type} onChange={(e) => set("unit_type", e.target.value)}><option value="">Todos</option>{options.unit_types.map((x) => <option key={x}>{x}</option>)}</select></div>

        {isOffshore && (
          <>
            <div><label htmlFor="f-basin">Bacia</label><select id="f-basin" value={filters.basin} onChange={(e) => set("basin", e.target.value)}><option value="">Todas</option>{options.basins.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="f-field">Campo</label><select id="f-field" value={filters.field} onChange={(e) => set("field", e.target.value)}><option value="">Todos</option>{options.fields.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="f-operator">Operador</label><select id="f-operator" value={filters.operator} onChange={(e) => set("operator", e.target.value)}><option value="">Todos</option>{options.operators.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="f-oil">Óleo mín. (bpd)</label><input id="f-oil" type="number" value={filters.oil} onChange={(e) => set("oil", e.target.value)} /></div>
            <div><label htmlFor="f-gas">Gás mín. (MMm³/d)</label><input id="f-gas" type="number" value={filters.gas} onChange={(e) => set("gas", e.target.value)} /></div>
            <div><label htmlFor="f-year">Ano mín.</label><input id="f-year" type="number" value={filters.year} onChange={(e) => set("year", e.target.value)} /></div>
            <div><label htmlFor="f-accommodation">Acomodação mín.</label><input id="f-accommodation" type="number" value={filters.accommodation} onChange={(e) => set("accommodation", e.target.value)} /></div>
            <div><label htmlFor="f-sort">Ordenar por</label><select id="f-sort" value={filters.sort} onChange={(e) => set("sort", e.target.value)}><option value="oil">Óleo</option><option value="gas">Gás</option><option value="boed">BOE/d</option><option value="storage_m3">Armazenamento</option><option value="length_m">Comprimento</option><option value="weight_t">Peso</option><option value="distance_to_coast_km">Distância costa</option><option value="year">Ano</option><option value="name">Nome</option></select></div>
          </>
        )}

        {isOnshore && (
          <>
            <div><label htmlFor="f-basin">Bacia</label><select id="f-basin" value={filters.basin} onChange={(e) => set("basin", e.target.value)}><option value="">Todas</option>{options.basins.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="f-field">Campo</label><select id="f-field" value={filters.field} onChange={(e) => set("field", e.target.value)}><option value="">Todos</option>{options.fields.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="f-operator">Operador</label><select id="f-operator" value={filters.operator} onChange={(e) => set("operator", e.target.value)}><option value="">Todos</option>{options.operators.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="f-oil">Óleo mín. (bpd)</label><input id="f-oil" type="number" value={filters.oil} onChange={(e) => set("oil", e.target.value)} /></div>
            <div><label htmlFor="f-gas">Gás mín. (MMm³/d)</label><input id="f-gas" type="number" value={filters.gas} onChange={(e) => set("gas", e.target.value)} /></div>
            <div><label htmlFor="f-year">Ano mín.</label><input id="f-year" type="number" value={filters.year} onChange={(e) => set("year", e.target.value)} /></div>
            <div><label htmlFor="f-wells">Poços mín.</label><input id="f-wells" type="number" value={filters.wells} onChange={(e) => set("wells", e.target.value)} /></div>
            <div><label htmlFor="f-sort">Ordenar por</label><select id="f-sort" value={filters.sort} onChange={(e) => set("sort", e.target.value)}><option value="oil">Óleo</option><option value="gas">Gás</option><option value="boed">BOE/d</option><option value="wells_productive">Poços</option><option value="year">Ano</option><option value="name">Nome</option></select></div>
          </>
        )}

        {isRefino && (
          <>
            <div><label htmlFor="f-state">Estado</label><select id="f-state" value={filters.state} onChange={(e) => set("state", e.target.value)}><option value="">Todos</option>{options.states.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="f-municipality">Município</label><select id="f-municipality" value={filters.municipality} onChange={(e) => set("municipality", e.target.value)}><option value="">Todos</option>{options.municipalities.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="f-operator">Operador</label><select id="f-operator" value={filters.operator} onChange={(e) => set("operator", e.target.value)}><option value="">Todos</option>{options.operators.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="f-oil">Capacidade mín. (bpd)</label><input id="f-oil" type="number" value={filters.oil} onChange={(e) => set("oil", e.target.value)} /></div>
            <div><label htmlFor="f-gas">Gás mín. (MMm³/d)</label><input id="f-gas" type="number" value={filters.gas} onChange={(e) => set("gas", e.target.value)} /></div>
            <div><label htmlFor="f-storage">Armazenamento mín. (m³)</label><input id="f-storage" type="number" value={filters.storage} onChange={(e) => set("storage", e.target.value)} /></div>
            <div><label htmlFor="f-year">Ano mín.</label><input id="f-year" type="number" value={filters.year} onChange={(e) => set("year", e.target.value)} /></div>
            <div><label htmlFor="f-sort">Ordenar por</label><select id="f-sort" value={filters.sort} onChange={(e) => set("sort", e.target.value)}><option value="oil">Capacidade</option><option value="gas">Gás</option><option value="storage_m3">Armazenamento</option><option value="year">Ano</option><option value="name">Nome</option></select></div>
          </>
        )}

        <button onClick={resetFilters}>Limpar filtros</button>
      </section>

      {loading && <div className="loading">Carregando plataformas...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="layout">
            <section className="panel">
              <div className="panel-head">
                <h2>{isOnshore ? "Campos e Unidades" : isRefino ? "Refinarias, Terminais, Gás e Compressão" : "Plataformas"} ({filtered.length})</h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="pill">Selecionadas: {selected.length}/10</span>
                  <button className="clear-btn" onClick={() => setSelectedIds([])}>Limpar seleção</button>
                  <button style={actionBtnStyle} onClick={shareUrl} title="Copia um link que restaura esta seleção ao abrir">🔗 Copiar link</button>
                  <button style={actionBtnStyle} onClick={exportCSV} title="Baixa o comparativo das unidades selecionadas em CSV">⬇️ Exportar CSV</button>
                </div>
              </div>
              <div className="panel-body list">
                {filtered.map((p) => (
                  <article key={p.id} className={`card ${selectedIds.includes(p.id) ? "selected" : ""}`}>
                    <div className="card-top"><h4>{p.name}</h4><span className={`pill ${p.status}`}>{STATUS_LABEL[p.status] ?? p.status}</span></div>
                    <div className="meta">
                      <span>Tipo: {p.unit_type || "—"}</span>
                      {isRefino ? (
                        <>
                          <span>Estado: {(p as any).state || "—"}</span>
                          <span>Município: {(p as any).municipality || "—"}</span>
                        </>
                      ) : (
                        <>
                          <span>Bacia: {p.basin || "—"}</span>
                          <span>Campo: {p.field || "—"}</span>
                        </>
                      )}
                      <span>Operador: {p.operator || "—"}</span>
                      <span>Ano: {p.year || "—"}</span>
                      {isOffshore && <span>Costa: {num(p.distance_to_coast_km, " km")}</span>}
                      <span>Lat: {p.latitude ?? "—"}</span><span>Lon: {p.longitude ?? "—"}</span>
                    </div>
                    <div className="metrics">
                      {isRefino ? (
                        <>
                          <span className="metric">Capacidade<b>{num(p.oil_bpd, " bpd")}</b></span>
                          <span className="metric">Gás<b>{num(p.gas_mmd, " MMm³/d")}</b></span>
                          <span className="metric">Armazenamento<b>{num(p.storage_m3, " m³")}</b></span>
                        </>
                      ) : (
                        <>
                          <span className="metric">Óleo<b>{num(p.oil_bpd, " bpd")}</b></span>
                          <span className="metric">Gás<b>{num(p.gas_mmd, " MMm³/d")}</b></span>
                          <span className="metric">BOE<b>{num(p.boed, "/d")}</b></span>
                        </>
                      )}
                      {isOffshore && (
                        <>
                          <span className="metric">Acomodação<b>{num(p.accommodation)}</b></span>
                          <span className="metric">Armazenamento<b>{num(p.storage_m3, " m³")}</b></span>
                          <span className="metric">Comprimento<b>{num(p.length_m, " m")}</b></span>
                          <span className="metric">Peso<b>{num(p.weight_t, " t")}</b></span>
                        </>
                      )}
                      {isOnshore && <span className="metric">Poços<b>{num((p as any).wells_productive)}</b></span>}
                    </div>
                    <button className={`select-btn ${selectedIds.includes(p.id) ? "active" : ""}`} onClick={() => toggle(p.id)}>{selectedIds.includes(p.id) ? "Remover do comparativo" : "Selecionar para comparativo"}</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Mapa — unidades selecionadas</h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button style={{ ...actionBtnStyle, background: showHeatmap ? "#008542" : (isDark ? "#123a5c" : "#e8eef4"), color: showHeatmap ? "#fff" : (isDark ? "#fff" : "#0c2340") }} onClick={() => setShowHeatmap(!showHeatmap)} title="Mostra a concentração de unidades por região">
                    🔥 Heatmap de densidade
                  </button>
                  <span className="pill">{selected.length}/10 no mapa</span>
                </div>
              </div>
              <MapContainer className="map" center={[-24, -42]} zoom={5} scrollWheelZoom>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <DensityHeatmap points={densityPoints} visible={showHeatmap} />
                {selected.filter((p) => p.latitude !== null && p.longitude !== null).map((p) => {
                  const color = pinColor(p.id);
                  return (
                    <Marker key={p.id} position={[p.latitude!, p.longitude!]} icon={pinIcon(color)}>
                      <LeafletTooltip>{p.name}</LeafletTooltip>
                      <Popup><strong>{p.name}</strong><br />{STATUS_LABEL[p.status] ?? p.status}<br />{p.unit_type}<br />Operador: {p.operator || "—"}<br />{isRefino ? `Estado: ${(p as any).state || "—"}` : `Campo: ${p.field || "—"}`}<br />Óleo: {num(p.oil_bpd, " bpd")}<br />Gás: {num(p.gas_mmd, " MMm³/d")}</Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
              <div className="map-legend">
                <strong>Legenda:</strong>
                {showHeatmap && <span className="legend-item" style={{ color: axisColor }}>Verde = baixa densidade · Amarelo = média · Vermelho = alta concentração</span>}
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
              {["comparativo", "estatisticas", "graficos", "radar", "temporal"].map((x) => <button key={x} className={`tab ${tab === x ? "active" : ""}`} onClick={() => setTab(x)}>{x === "temporal" ? "Temporal" : x === "radar" ? "Radar" : x === "estatisticas" ? "Estatísticas" : x.charAt(0).toUpperCase() + x.slice(1)}</button>)}
            </div>
            <div className="panel-body">
              {tab === "comparativo" && (
                <div className="table-wrap">
                  <table className="table"><thead><tr><th>Unidade</th><th>Status</th><th>Tipo</th>{isRefino ? <><th>Estado</th><th>Município</th></> : <><th>Bacia</th><th>Campo</th></>}<th>Operador</th><th>Óleo</th><th>Gás (MMm³/d)</th><th>BOE/d</th><th>Ano</th>{isOffshore && <><th>Acomodação</th><th>Armazenamento</th><th>Comprimento</th><th>Peso</th><th>Distância costa (km)</th></>}{isOnshore && <th>Poços produtivos</th>}{isRefino && <th>Armazenamento (m³)</th>}</tr></thead><tbody>
                    {selected.map((p) => <tr key={p.id}><td>{p.name}</td><td>{STATUS_LABEL[p.status] ?? p.status}</td><td>{p.unit_type}</td>{isRefino ? <><td>{(p as any).state || "—"}</td><td>{(p as any).municipality || "—"}</td></> : <><td>{p.basin || "—"}</td><td>{p.field || "—"}</td></>}<td>{p.operator || "—"}</td><td>{num(p.oil_bpd)}</td><td>{num(p.gas_mmd, " MMm³/d")}</td><td>{num(p.boed)}</td><td>{p.year || "—"}</td>{isOffshore && <><td>{num(p.accommodation)}</td><td>{num(p.storage_m3)}</td><td>{num(p.length_m)}</td><td>{num(p.weight_t)}</td><td>{num(p.distance_to_coast_km, " km")}</td></>}{isOnshore && <td>{num((p as any).wells_productive)}</td>}{isRefino && <td>{num(p.storage_m3)}</td>}</tr>)}
                  </tbody></table>
                </div>
              )}
              {tab === "estatisticas" && (
                <div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                    <div style={kpiStyle}><span style={kpiLabel}>Unidades filtradas</span><strong style={kpiValue}>{filtered.length}</strong><span style={{ fontSize: 11, opacity: 0.6 }}>{activeUnits.length} na base total</span></div>
                    <div style={kpiStyle}><span style={kpiLabel}>{isRefino ? "Capacidade total" : "Óleo total"}</span><strong style={kpiValue}>{num(totals.oil, " bpd")}</strong></div>
                    <div style={kpiStyle}><span style={kpiLabel}>Gás total</span><strong style={kpiValue}>{num(totals.gas, " MMm³/d")}</strong></div>
                    {!isRefino && <div style={kpiStyle}><span style={kpiLabel}>BOE total</span><strong style={kpiValue}>{num(totals.boe, "/d")}</strong></div>}
                    {isRefino && <div style={kpiStyle}><span style={kpiLabel}>Armazenamento total</span><strong style={kpiValue}>{num(totals.storage, " m³")}</strong></div>}
                    {isOnshore && <div style={kpiStyle}><span style={kpiLabel}>Poços produtivos</span><strong style={kpiValue}>{num(totals.wells)}</strong></div>}
                    {isOffshore && (
                      <>
                        <div style={kpiStyle}><span style={kpiLabel}>Profundidade média</span><strong style={kpiValue}>{num(Math.round(avgDepth), " m")}</strong><span style={{ fontSize: 11, opacity: 0.6 }}>máx: {num(maxDepth, " m")}</span></div>
                        <div style={kpiStyle}><span style={kpiLabel}>Acomodação total</span><strong style={kpiValue}>{num(totalAccommodation)}</strong><span style={{ fontSize: 11, opacity: 0.6 }}>pessoas</span></div>
                      </>
                    )}
                  </div>

                  {isOnshore && (
                    <div style={chartRowStyle}>
                      <div style={chartBoxStyle}>
                        <h4 style={chartTitleStyle}>Comparação por Polo — campos e poços</h4>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={poloData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                            <YAxis stroke={axisColor} />
                            <Tooltip content={<CustomTooltip />} /><Legend />
                            <Bar dataKey="count" name="Campos" fill="#008542" />
                            <Bar dataKey="wells" name="Poços" fill="#ffcc29" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={chartBoxStyle}>
                        <h4 style={chartTitleStyle}>Totais por Polo</h4>
                        <div className="table-wrap">
                          <table className="table">
                            <thead><tr><th>Polo</th><th>Campos</th><th>Poços</th><th>Óleo (bpd)</th><th>Gás (MMm³/d)</th><th>BOE/d</th></tr></thead>
                            <tbody>
                              {poloData.map((x) => (
                                <tr key={x.name}><td>{x.name}</td><td>{x.count}</td><td>{num(x.wells)}</td><td>{num(x.oil)}</td><td>{num(x.gas)}</td><td>{num(x.boe)}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={chartRowStyle}>
                    <div style={chartBoxStyle}>
                      <h4 style={chartTitleStyle}>Distribuição por status</h4>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                            {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} /><Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={chartBoxStyle}>
                      <h4 style={chartTitleStyle}>{isRefino ? "Top estados por nº de unidades" : "Top bacias por nº de unidades"}</h4>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={basinData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="name" stroke={axisColor} fontSize={11} />
                          <YAxis stroke={axisColor} />
                          <Tooltip content={<CustomTooltip />} /><Legend />
                          <Bar dataKey="Unidades" fill="#008542" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={chartRowStyle}>
                    <div style={chartBoxStyle}>
                      <h4 style={chartTitleStyle}>Top operadores por produção de óleo (bpd)</h4>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={operatorData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis type="number" stroke={axisColor} />
                          <YAxis type="category" dataKey="name" stroke={axisColor} width={140} fontSize={11} />
                          <Tooltip content={<CustomTooltip />} /><Legend />
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
                          <Tooltip content={<CustomTooltip />} /><Legend />
                          <Bar dataKey="value" name="Unidades" fill="#ffcc29" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
                    <div style={rankBoxStyle}>
                      <h4 style={chartTitleStyle}>{isRefino ? "Top 5 por capacidade" : "Top 5 produtores de óleo"}</h4>
                      <ol style={rankTextStyle}>
                        {topOil.map((p) => <li key={p.id} style={{ marginBottom: 6 }}><strong style={{ color: rankStrongColor }}>{p.name}</strong> — {num(p.oil_bpd, " bpd")}</li>)}
                        {topOil.length === 0 && <li>Nenhuma unidade com produção de óleo nos filtros atuais.</li>}
                      </ol>
                    </div>
                    {isOffshore && (
                      <div style={rankBoxStyle}>
                        <h4 style={chartTitleStyle}>Top 5 por profundidade</h4>
                        <ol style={rankTextStyle}>
                          {topDepth.map((p) => <li key={p.id} style={{ marginBottom: 6 }}><strong style={{ color: rankStrongColor }}>{p.name}</strong> — {num(p.water_depth_m, " m")}</li>)}
                          {topDepth.length === 0 && <li>Nenhuma unidade com profundidade informada nos filtros atuais.</li>}
                        </ol>
                      </div>
                    )}
                    {isRefino && (
                      <div style={rankBoxStyle}>
                        <h4 style={chartTitleStyle}>Top 5 por armazenamento</h4>
                        <ol style={rankTextStyle}>
                          {topStorage.map((p) => <li key={p.id} style={{ marginBottom: 6 }}><strong style={{ color: rankStrongColor }}>{p.name}</strong> — {num(p.storage_m3, " m³")}</li>)}
                          {topStorage.length === 0 && <li>Nenhum terminal com armazenamento nos filtros atuais.</li>}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {tab === "graficos" && (
                <div className="charts">
                  <h3>{isOnshore ? "Comparação dos campos selecionados" : isRefino ? "Comparação das unidades selecionadas" : "Comparação das plataformas selecionadas"} ({selected.length}/10)</h3>
                  {isOnshore && selected.some((p) => (p as any).producao_polo_gas_mmd != null) && (
                    <p style={{ color: axisColor, fontSize: 13 }}>Para os campos do Polo Urucu sem produção individual divulgada, é exibida a produção agregada do Polo Arara (7,252 MMm³/dia), identificada com "(polo)".</p>
                  )}
                  {selected.length === 0 && <p style={{ color: axisColor }}>Selecione {isOnshore ? "campos" : isRefino ? "unidades" : "plataformas"} na lista à esquerda para ver os gráficos comparativos.</p>}
                  {selected.length > 0 && (
                    <>
                      <div style={chartRowStyle}>
                        <div style={chartBoxStyle}>
                          <h4 style={chartTitleStyle}>{isRefino ? "Capacidade de processamento (bpd)" : "Produção de Óleo e BOE"}</h4>
                          <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                              <XAxis dataKey="name" stroke={axisColor} fontSize={11} interval={0} angle={-35} textAnchor="end" height={100} />
                              <YAxis stroke={axisColor} />
                              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.06)" }} /><Legend />
                              <Bar dataKey="Óleo" fill="#008542" />
                              {!isRefino && <Bar dataKey="BOE" fill="#ffcc29" />}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {isRefino ? (
                          <div style={chartBoxStyle}>
                            <h4 style={chartTitleStyle}>Capacidade de Gás (MMm³/d)</h4>
                            <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis dataKey="name" stroke={axisColor} fontSize={11} interval={0} angle={-35} textAnchor="end" height={100} />
                                <YAxis stroke={axisColor} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.06)" }} /><Legend />
                                <Bar dataKey="Gás" fill="#f28c28" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div style={chartBoxStyle}>
                            <h4 style={chartTitleStyle}>Produção de Gás</h4>
                            <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis dataKey="name" stroke={axisColor} fontSize={11} interval={0} angle={-35} textAnchor="end" height={100} />
                                <YAxis stroke={axisColor} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.06)" }} /><Legend />
                                <Bar dataKey="Gás" fill="#f28c28" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                      {isRefino && (
                        <div style={chartRowStyle}>
                          <div style={chartBoxStyle}>
                            <h4 style={chartTitleStyle}>Capacidade de Armazenamento (m³)</h4>
                            <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis dataKey="name" stroke={axisColor} fontSize={11} interval={0} angle={-35} textAnchor="end" height={100} />
                                <YAxis stroke={axisColor} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.06)" }} /><Legend />
                                <Bar dataKey="Armazenamento" fill="#0072ce" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                      {isOnshore && (
                        <div style={chartRowStyle}>
                          <div style={chartBoxStyle}>
                            <h4 style={chartTitleStyle}>Poços Produtivos</h4>
                            <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis dataKey="name" stroke={axisColor} fontSize={11} interval={0} angle={-35} textAnchor="end" height={100} />
                                <YAxis stroke={axisColor} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.06)" }} /><Legend />
                                <Bar dataKey="Poços" fill="#0072ce" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      <div style={chartRowStyle}>
                        <div style={chartBoxStyle}>
                          <h4 style={chartTitleStyle}>Dispersão — Óleo (bpd) vs. Gás (MMm³/d)</h4>
                          <p style={{ color: axisColor, fontSize: 12, marginTop: 0 }}>Cada ponto é uma unidade; o tamanho do círculo representa o BOE/d.</p>
                          <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                              <XAxis type="number" dataKey="x" name="Óleo (bpd)" stroke={axisColor} fontSize={11} />
                              <YAxis type="number" dataKey="y" name="Gás (MMm³/d)" stroke={axisColor} fontSize={11} />
                              <ZAxis type="number" dataKey="z" range={[60, 400]} name="BOE/d" />
                              <Tooltip content={<CustomScatterTooltip />} />
                              <Scatter data={scatterData} fill="#008542">
                                {scatterData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                              </Scatter>
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {!isRefino && (
                        <div style={chartRowStyle}>
                          <div style={chartBoxStyle}>
                            <h4 style={chartTitleStyle}>{isOnshore ? "Indicador de eficiência — BOE por poço" : "Indicador de eficiência — Óleo por acomodação"}</h4>
                            <p style={{ color: axisColor, fontSize: 12, marginTop: 0 }}>{isOnshore ? "BOE/d dividido pelo número de poços produtivos de cada campo." : "Produção de óleo (bpd) dividida pela capacidade de acomodação de cada plataforma."}</p>
                            <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                              <BarChart data={efficiencyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis dataKey="name" stroke={axisColor} fontSize={11} interval={0} angle={-35} textAnchor="end" height={100} />
                                <YAxis stroke={axisColor} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.06)" }} /><Legend />
                                {isOnshore && <Bar dataKey="BOE/poço" fill="#7a28a0" />}
                                {isOffshore && <Bar dataKey="Óleo/acomodação" fill="#00a878" />}
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {tab === "radar" && (
                <div className="charts">
                  <h3>Radar comparativo — unidades selecionadas ({selected.length}/10)</h3>
                  {selected.length === 0 && <p style={{ color: axisColor }}>Selecione unidades na lista à esquerda para ver o radar comparativo.</p>}
                  {selected.length > 0 && (
                    <div style={chartRowStyle}>
                      <div style={chartBoxStyle}>
                        <h4 style={chartTitleStyle}>Radar comparativo — Óleo, Gás e BOE</h4>
                        <p style={{ color: axisColor, fontSize: 12, marginTop: 0 }}>Cada eixo é normalizado de 0 a 100 em relação à maior unidade selecionada naquele indicador.</p>
                        <ResponsiveContainer width="100%" height={isMobile ? 320 : 420}>
                          <RadarChart data={radarData}>
                            <PolarGrid stroke={gridColor} />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: axisColor, fontSize: 12 }} />
                            <PolarRadiusAxis domain={[0, 100]} tick={{ fill: axisColor, fontSize: 10 }} />
                            {selected.map((p, i) => (
                              <Radar key={p.id} name={p.name} dataKey={p.name} stroke={PIN_COLORS[i % PIN_COLORS.length]} fill={PIN_COLORS[i % PIN_COLORS.length]} fillOpacity={0.25} />
                            ))}
                            <Legend />
                            <Tooltip content={<CustomTooltip />} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {tab === "temporal" && (
                <div className="charts">
                  <h3>Série Temporal — produção mensal por campo ({selected.length}/10)</h3>
                  <p style={{ color: axisColor, fontSize: 13 }}>Fonte: banco de dados próprio (SQLite) a partir dos dados abertos da ANP (2021-2023). Óleo em bbl/dia; gás em Mm³/dia.</p>
                  {selected.length === 0 && <p style={{ color: axisColor }}>Selecione unidades na lista à esquerda para carregar a série temporal.</p>}
                  {selected.length > 0 && (
                    <>
                      <button style={{ ...actionBtnStyle, background: "#008542", color: "#fff" }} onClick={carregarSerie} disabled={serieStatus === "loading"}>
                        {serieStatus === "loading" ? "Carregando série..." : "📈 Carregar série temporal"}
                      </button>
                      {serieStatus === "erro" && <p style={{ color: "#e30613", marginTop: 8 }}>Erro: {serieErro}</p>}
                      {serieStatus === "ok" && serieCampos.length === 0 && <p style={{ color: axisColor, marginTop: 8 }}>Nenhum dos campos selecionados retornou dados históricos.</p>}
                      {serieCampos.length > 0 && (
                        <>
                          <h5 style={{ color: isDark ? "#fff" : "#0c2340", margin: "16px 0 4px" }}>Óleo (bbl/dia)</h5>
                          <ResponsiveContainer width="100%" height={isMobile ? 260 : 320}>
                            <LineChart data={serieData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                              <XAxis dataKey="periodo" stroke={axisColor} fontSize={11} />
                              <YAxis stroke={axisColor} />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend wrapperStyle={{ color: isDark ? "#e2e8f0" : "#0c2340" }} />
                              {serieCampos.map((campo, i) => (
                                <Line key={campo} type="monotone" dataKey={`oleo_${campo}`} name={`${campo} — Óleo`} stroke={SERIE_COLORS[i % SERIE_COLORS.length]} strokeWidth={2.5} dot={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                          <h5 style={{ color: isDark ? "#fff" : "#0c2340", margin: "16px 0 4px" }}>Gás (Mm³/dia)</h5>
                          <ResponsiveContainer width="100%" height={isMobile ? 260 : 320}>
                            <LineChart data={serieData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                              <XAxis dataKey="periodo" stroke={axisColor} fontSize={11} />
                              <YAxis stroke={axisColor} />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend wrapperStyle={{ color: isDark ? "#e2e8f0" : "#0c2340" }} />
                              {serieCampos.map((campo, i) => (
                                <Line key={campo} type="monotone" dataKey={`gas_${campo}`} name={`${campo} — Gás`} stroke={SERIE_COLORS[i % SERIE_COLORS.length]} strokeWidth={2.5} dot={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <footer className="footer">
        <p>© 2026 Ricardo S. Rodrigues — Chave AXIF</p>
      </footer>
    </div>
  );
}
