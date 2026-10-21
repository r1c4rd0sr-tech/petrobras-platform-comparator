import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchProductionHistory } from "../api";
import type { MonthlyProduction } from "../types";

interface Props {
  slug: string;
}

export default function ProductionHistory({ slug }: Props) {
  const [records, setRecords] = useState<MonthlyProduction[]>([]);

  useEffect(() => {
    fetchProductionHistory(slug).then(setRecords);
  }, [slug]);

  const chartData = records.map((r) => ({period: r.period, oil: r.oil_bpd, gas: r.gas_mmd, boed: r.boed}));

  return (
    <section>
      <h3>Histórico mensal — {slug.toUpperCase()}</h3>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="oil" name="Óleo (bpd)" stroke="#0ea5e9" />
          <Line type="monotone" dataKey="gas" name="Gás (MMm³/d)" stroke="#22c55e" />
          <Line type="monotone" dataKey="boed" name="BOE/d" stroke="#f59e0b" />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
