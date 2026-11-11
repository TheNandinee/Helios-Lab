"use client";

import { useLabStore } from "@/store/useLabStore";
import { SPECS } from "@/components/bench/Workbench";

export default function Inspector() {
  const { components, selectedId, removeComponent, select } = useLabStore();
  const item = components.find((c) => c.id === selectedId);
  if (!item) return null;

  return (
    <div className="glass rounded-xl p-4 space-y-2 w-64">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sky-300">{SPECS[item.type].label}</h2>
        <button onClick={() => select(null)} className="text-slate-400 hover:text-white">✕</button>
      </div>
      <p className="text-xs text-slate-400">ID: {item.id}</p>
      <p className="text-xs text-slate-400">
        Position: x {item.position[0].toFixed(2)}, z {item.position[2].toFixed(2)}
      </p>
      <p className="text-xs text-slate-500">Pin configuration arrives in Phase 2.</p>
      <button
        onClick={() => removeComponent(item.id)}
        className="w-full rounded-md bg-red-500/20 py-1.5 text-sm text-red-300 hover:bg-red-500/30"
      >
        Remove from bench
      </button>
    </div>
  );
}