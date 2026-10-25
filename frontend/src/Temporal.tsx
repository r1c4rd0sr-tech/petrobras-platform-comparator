import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const API = import.meta.env.VITE_API_URL ?? "";

const CORES = ["#008542", "#ffcc29", "#0072ce", "#e30613", "#7a28a0", "#00a3e0", "#f26522", "#8dc63f"];

export default function Temporal() {
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState("");
  const [anoMin, setAnoMin] = useState<number | null>(null);
  const [anoMax, setAnoMax] = useState<number | null>(null);
  const [polosSel, setPolosSel] = useState<string[]>([]);
  const [ufsSel, setUfsSel] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API}/api/temporal/refino-gas-logistica`)
      .then((r) => r.json())
      .then((d) => {
        setDados(d);
        const anos = (d.refino?.capacidade_por_ano ?? []).map((x: any) => x.ano);
        if (anos.length) {
          setAnoMin(Math.min(...anos));
          setAnoMax(Math.max(...anos));
        }
        const polos = (d.gas?.capacidade_por_polo ?? []).slice(0, 5).map((p: any) => p.polo);
        setPolosSel(polos);
        const ufs = (d.logistica?.armazenagem_por_uf ?? []).map((u: any) => u.uf);
        setUfsSel(ufs);
      })
      .catch(() => setErro("Não foi possível carregar os dados do Temporal."));
  }, []);

  const anos = useMemo(() => (dados?.refino?.capacidade_por_ano ?? []).map((d: any) => d.ano), [dados]);
  const anoMinDisp = anos.length ? Math.min(...anos) : 0;
  const anoMaxDisp = anos.length ? Math.max(...anos) : 0;

  if (erro) return <p style={{ color: "#fff", padding: 24 }}>{erro}</p>;
  if (!dados) return <p style={{ color: "#fff", padding: 24 }}>Carregando Temporal…</p>;

  const refino = (dados.refino?.capacidade_por_ano ?? [])
    .filter((d: any) => d.ano >= (anoMin ?? anoMinDisp) && d.ano <= (anoMax ?? anoMaxDisp))
    .map((d: any) => ({ ano: d.ano, Capacidade: d.capacidade }));

  const todosPolos = (dados.gas?.capacidade_por_polo ?? []).slice(0, 5);
  const gasPolos = todosPolos.filter((p: any) => polosSel.includes(p.polo));
  const gasData = (gasPolos[0]?.serie ?? [])
    .filter((d: any) => d.ano >= (anoMin ?? anoMinDisp) && d.ano <= (anoMax ?? anoMaxDisp))
    .map((d: any) => {
      const row: any = { ano: d.ano };
      gasPolos.forEach((p: any) => {
        const ponto = p.serie.find((x: any) => x.ano === d.ano);
        row[p.polo] = ponto?.capacidade ?? 0;
      });
      return row;
    });

  const logistica = (dados.logistica?.armazenagem_por_uf ?? [])
    .filter((d: any) => ufsSel.includes(d.uf))
    .map((d: any) => ({ uf: d.uf, Capacidade: d.capacidade }));

  const cardStyle: React.CSSProperties = { background: "#0f2740", borderRadius: 12, padding: 16, flex: "1 1 420px", minWidth: 0 };
  const titleStyle: React.CSSProperties = { color: "#fff", marginTop: 0, fontSize: 18 };
  const labelStyle: React.CSSProperties = { color: "#93a7bb", fontSize: 13, marginRight: 8 };
  const selectStyle: React.CSSProperties = { background: "#0c2340", color: "#fff", border: "1px solid #22384f", borderRadius: 6, padding: "6px 8px", fontSize: 13 };

  const toggle = (lista: string[], valor: string, set: (v: string[]) => void) => {
    set(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  };

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 900px) {
          .temporal-cards { flex-direction: column; }
          .temporal-card { flex: 1 1 100% !important; }
          .temporal-filtros { flex-direction: column; align-items: stretch; }
        }
      `}</style>

      <h1 style={{ color: "#fff", marginTop: 0 }}>Temporal — Refino, Gás e Logística</h1>

      <div className="temporal-filtros" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <div>
          <span style={labelStyle}>Ano inicial</span>
          <select style={selectStyle} value={anoMin ?? anoMinDisp} onChange={(e) => setAnoMin(Number(e.target.value))}>
            {anos.map((a: number) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Ano final</span>
          <select style={selectStyle} value={anoMax ?? anoMaxDisp} onChange={(e) => setAnoMax(Number(e.target.value))}>
            {anos.map((a: number) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Polos (Gás)</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {todosPolos.map((p: any) => (
              <label key={p.polo} style={{ color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={polosSel.includes(p.polo)} onChange={() => toggle(polosSel, p.polo, setPolosSel)} />
                {p.polo}
              </label>
            ))}
          </div>
        </div>
        <div>
          <span style={labelStyle}>UFs (Logística)</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 480 }}>
            {(dados.logistica?.armazenagem_por_uf ?? []).map((u: any) => (
              <label key={u.uf} style={{ color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={ufsSel.includes(u.uf)} onChange={() => toggle(ufsSel, u.uf, setUfsSel)} />
                {u.uf}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="temporal-cards" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="temporal-card" style={cardStyle}>
          <h2 style={titleStyle}>Refino — Capacidade por ano</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={refino}>
              <CartesianGrid stroke="#22384f" />
              <XAxis dataKey="ano" stroke="#93a7bb" />
              <YAxis stroke="#93a7bb" />
              <Tooltip />
              <Line type="monotone" dataKey="Capacidade" stroke="#008542" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="temporal-card" style={cardStyle}>
          <h2 style={titleStyle}>Gás — Capacidade por polo</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={gasData}>
              <CartesianGrid stroke="#22384f" />
              <XAxis dataKey="ano" stroke="#93a7bb" />
              <YAxis stroke="#93a7bb" />
              <Tooltip />
              <Legend />
              {gasPolos.map((p: any, i: number) => (
                <Line key={p.polo} type="monotone" dataKey={p.polo} stroke={CORES[i % CORES.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="temporal-card" style={cardStyle}>
          <h2 style={titleStyle}>Logística — Armazenagem por UF</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={logistica}>
              <CartesianGrid stroke="#22384f" />
              <XAxis dataKey="uf" stroke="#93a7bb" />
              <YAxis stroke="#93a7bb" />
              <Tooltip />
              <Bar dataKey="Capacidade" fill="#0072ce" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
