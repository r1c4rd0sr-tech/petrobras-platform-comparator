import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Platform } from "../types";

interface Props {
  platforms: Platform[];
}

export default function PlatformMap({ platforms }: Props) {
  const located = platforms.filter((p) => p.latitude !== null && p.longitude !== null);

  return (
    <MapContainer center={[-24, -42]} zoom={5} style={{height: "520px", width: "100%"}}>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {located.map((platform) => (
        <Marker key={platform.id} position={[platform.latitude!, platform.longitude!]}>
          <Popup>
            <strong>{platform.name}</strong>
            <br />
            {platform.unit_type} • {platform.field ?? "Campo não informado"}
            <br />
            Óleo: {platform.oil_bpd ?? "—"} bpd
            <br />
            Gás: {platform.gas_mmd ?? "—"} MMm³/d
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
