import { useEffect, useState } from "react";
import type { Vessel } from "../types/index.js";

interface VesselInfoProps {
  vesselId: string;
}

export function VesselInfo({ vesselId }: VesselInfoProps) {
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL ?? "";
    fetch(`${base}/api/vessels/${vesselId}`)
      .then((r) => r.json())
      .then((data: Vessel) => setVessel(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vesselId]);

  if (loading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="h-4 bg-navy-700 rounded w-1/2" />
        <div className="h-3 bg-navy-700 rounded w-3/4" />
        <div className="h-3 bg-navy-700 rounded w-2/3" />
      </div>
    );
  }

  if (!vessel) {
    return <div className="card text-red-400 text-sm">Vessel data unavailable</div>;
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-white text-lg leading-tight">{vessel.name}</h2>
          <p className="text-xs text-gray-500 font-mono mt-0.5">IMO: {vessel.imo}</p>
        </div>
        <span className="badge bg-aegis-green/10 text-aegis-green border border-aegis-green/20">
          <span className="w-1.5 h-1.5 rounded-full bg-aegis-green" />
          {vessel.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <InfoBlock
          label="Position"
          value={`${vessel.coordinates.lat.toFixed(4)}° N, ${vessel.coordinates.lng.toFixed(4)}° E`}
          icon="📍"
        />
        <InfoBlock label="Destination" value={vessel.destination} icon="🏁" />
        <InfoBlock label="ETA" value={new Date(vessel.eta).toLocaleDateString()} icon="📅" />
      </div>
    </div>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-navy-900/50 rounded-lg p-2.5">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
        {icon} {label}
      </p>
      <p className="text-xs text-gray-300 font-medium">{value}</p>
    </div>
  );
}
