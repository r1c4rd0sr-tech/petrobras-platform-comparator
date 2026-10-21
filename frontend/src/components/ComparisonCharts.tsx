import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Platform } from "../types";

interface Props {
  platforms: Platform[];
}

export default function ComparisonCharts({ platforms }: Props) {
  const data = platforms.map((p) => ({name: p.name, oil: p.oil_bpd ?? 0, gas: p.gas_mmd ?? 0, boed: p.boed ?? 0}));

  return (
    <section>
      <h3>Comparativo de produção</h3>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="oil" name="Óleo (bpd)" fill="#0ea5e9" />
          <Bar dataKey="gas" name="Gás (MMm³/d)" fill="#22c55e" />
          <Bar dataKey="boed" name="BOE/d" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
