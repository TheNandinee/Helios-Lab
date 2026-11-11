"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { createDeviceKey, subscribeDevice } from "@/lib/telemetry";
import { cloudTrace } from "@/sim/trace";
import { MAIN_FILE, esp32Sketch } from "@/sim/templates";
import WokwiPanel from "@/components/sim/WokwiPanel";

const DB_URL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "";
const storageKey = (projectId: string | null) => `helios:devkey:${projectId ?? "scratch"}`;

export default function Esp32Panel() {
  const { user, projectId, metrics, setFile, setActiveFile } = useLabStore(
    useShallow((s) => ({
      user: s.user, projectId: s.projectId, metrics: s.sensorMetrics,
      setFile: s.setFile, setActiveFile: s.setActiveFile,
    }))
  );
  const [deviceKey, setDeviceKey] = useState<string | null>(() => {
    try { return localStorage.getItem(storageKey(projectId)); } catch { return null; }
  });
  const [status, setStatus] = useState("");
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !deviceKey) return;
    return subscribeDevice(deviceKey, (data) => {
      const now = performance.now() / 1000;
      const m: Record<string, number> = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v !== "number" || k === "ts") continue;
        m[k] = v;
        cloudTrace.record(k, v, now);
      }
      useLabStore.getState().setSensorMetrics(m);
      if (typeof data.ts === "number") setLastSeen(data.ts);
    });
  }, [user, deviceKey]);

  async function handleGenerate() {
    if (!user) return;
    setStatus("Creating key…");
    try {
      const key = await createDeviceKey(user.uid, projectId ?? "scratch");
      try { localStorage.setItem(storageKey(projectId), key); } catch { /* ignore */ }
      setDeviceKey(key);
      setStatus("Key created ✓");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not create key");
    }
  }

  function insertIntoSketch() {
    if (!deviceKey) return;
    setFile(MAIN_FILE.esp32, esp32Sketch(DB_URL, deviceKey));
    setActiveFile(MAIN_FILE.esp32);
    setStatus("Sketch updated, now copy it into Wokwi");
  }

  async function copySketch() {
    if (!deviceKey) return;
    await navigator.clipboard.writeText(esp32Sketch(DB_URL, deviceKey));
    setStatus("Copied ✓ Paste into Wokwi's sketch.ino and press play");
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="glass space-y-2 rounded-xl p-3 text-sm">
        <h2 className="text-sm font-semibold text-sky-300">ESP32 → Firebase</h2>
        {!user ? (
          <p className="text-xs text-amber-300">Sign in to stream ESP32 data to Firebase.</p>
        ) : !deviceKey ? (
          <button onClick={handleGenerate} className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950">
            Generate device key
          </button>
        ) : (
          <>
            <p className="truncate font-mono text-xs text-slate-400">key: {deviceKey}</p>
            <div className="flex gap-2">
              <button onClick={insertIntoSketch} className="rounded-md bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">Put in editor</button>
              <button onClick={copySketch} className="rounded-md bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">Copy sketch</button>
            </div>
            <div className="grid grid-cols-2 gap-1 font-mono text-xs">
              {Object.keys(metrics).length === 0 ? (
                <span className="col-span-2 text-slate-500">Waiting for the ESP32… (press play in Wokwi)</span>
              ) : (
                Object.entries(metrics).map(([k, v]) => (
                  <span key={k} className="rounded bg-slate-900/70 px-2 py-1">
                    {k}: <span className="text-emerald-300">{v}</span>
                  </span>
                ))
              )}
            </div>
            {lastSeen && <p className="text-xs text-slate-500">Last packet: {new Date(lastSeen).toLocaleTimeString()}</p>}
          </>
        )}
        {status && <p className="text-xs text-slate-400">{status}</p>}
      </div>
      <div className="min-h-[320px] flex-1"><WokwiPanel /></div>
    </div>
  );
}