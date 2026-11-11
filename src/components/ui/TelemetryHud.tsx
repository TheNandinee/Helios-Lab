"use client";

import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";

export default function TelemetryHud() {
  const { latency, highPins, remoteCount, user } = useLabStore(
    useShallow((s) => ({
      latency: s.telemetryLatency,
      highPins: Object.values(s.pinStates).filter((v) => v === 1).length,
      remoteCount: Object.keys(s.remotePins).length,
      user: s.user,
    }))
  );
  const ok = latency !== null && latency < 150;

  return (
    <div className="glass rounded-lg px-3 py-2 font-mono text-[11px] text-slate-300">
      <div>Pins HIGH (local): {highPins}</div>
      <div>Pins in cloud stream: {user ? remoteCount : "sign in"}</div>
      <div>
        Cloud write RTT:{" "}
        <span className={latency === null ? "" : ok ? "text-emerald-300" : "text-amber-300"}>
          {latency === null ? "–" : `${latency} ms`}
        </span>{" "}
        <span className="text-slate-500">(SLO &lt; 150 ms)</span>
      </div>
    </div>
  );
}