import { useState } from "react";

interface Props {
  onSearch: (filters: Record<string, unknown>) => void;
}

export default function PlatformFilters({ onSearch }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [basin, setBasin] = useState("");

  function submit() {
    onSearch({search: search || undefined, status: status || undefined, basin: basin || undefined});
  }

  return (
    <div className="filters">
      <input placeholder="Buscar unidade, campo ou bacia" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Todos os status</option>
        <option value="operational">Operacional</option>
        <option value="construction">Em construção</option>
        <option value="decommissioned">Descomissionada</option>
      </select>
      <input placeholder="Bacia" value={basin} onChange={(e) => setBasin(e.target.value)} />
      <button onClick={submit}>Filtrar</button>
    </div>
  );
}
