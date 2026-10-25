import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const API = import.meta.env.VITE_API_URL ?? "";

type Serie = { ano: number; valor: number };

export default function Temporal() {
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch(`${API}/api/temporal/refino-gas-logistica`)
      .then((r) => r.json())
      .then(setDados)
      .catch(() => setErro("Não foi possível carregar os dados do Temporal."));
  }, []);

  if (erro) return <p style={{ color: "#fff", padding: 24 }}>{erro}</p>;
  if (!dados) return <p style={{ color: "#fff", padding: 24 }}>Carregando Temporal…</p>;

  const refino = (dados.refino?.capacidade_por_ano ?? []).map((d: any) => ({ ano: d.ano, Capacidade: d.capacidade }));
  const gasPolos = (dados.gas?.capacidade_por_polo ?? []).slice(0, 5);
  const gasData = (gasPolos[0]?.serie ?? []).map((d: any) => {
    const row: any = { ano: d.ano };
    gasPolos.forEach((p: any) => {
      const ponto = p.serie.find((x: any) => x.ano === d.ano);
      row[p.polo] = ponto?.capacidade ?? 0;
    });
    return row;
  });
  const logistica = (dados.logistica?.armazenagem_por_uf ?? []).map((d: any) => ({ uf: d.uf, Capacidade: d.capacidade }));

  const cardStyle: React.CSSProperties = { background: "#0f2740", borderRadius: 12, padding: 16, flex: "1 1 320px", minWidth: 0 };
  const titleStyle: React.CSSProperties = { color: "#fff", marginTop: 0 };

  return (
    <div style={{ padding: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={cardStyle}>
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

      <div style={cardStyle}>
        <h2 style={titleStyle}>Gás — Capacidade por polo</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={gasData}>
            <CartesianGrid stroke="#22384f" />
            <XAxis dataKey="ano" stroke="#93a7bb" />
            <YAxis stroke="#93a7bb" />
            <Tooltip />
            <Legend />
            {gasPolos.map((p: any, i: number) => (
              <Line key={p.polo} type="monotone" dataKey={p.polo} stroke={["#008542", "#ffcc29", "#0072ce", "#e30613", "#7a28a0"][i % 5]} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
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
  );
}
