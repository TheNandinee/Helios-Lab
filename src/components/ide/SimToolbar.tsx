"use client";

import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { runSimulation, stopSimulation } from "@/sim/controller";

const STATUS_STYLE: Record<string, string> = {
  idle: "bg-slate-700 text-slate-300",
  compiling: "bg-amber-500/20 text-amber-300",
  running: "bg-emerald-500/20 text-emerald-300",
  error: "bg-red-500/20 text-red-300",
};

export default function SimToolbar() {
  const { simStatus, simError, buildMs, architecture } = useLabStore(
    useShallow((s) => ({ simStatus: s.simStatus, simError: s.simError, buildMs: s.buildMs, architecture: s.architecture }))
  );
  const active = simStatus === "running" || simStatus === "compiling";

  return (
    <div className="glass rounded-xl p-2 space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => runSimulation()}
          disabled={simStatus === "compiling"}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          ▶ Run
        </button>
        <button
          onClick={stopSimulation}
          disabled={!active}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-40"
        >
          ■ Stop
        </button>
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[simStatus]}`}>{simStatus}</span>
        <span className="ml-auto text-xs text-slate-400">
          {architecture}
          {buildMs !== null && ` · build ${buildMs} ms`}
        </span>
      </div>
      {simError && (
        <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-red-950/40 p-2 text-xs text-red-300">{simError}</pre>
      )}
    </div>
  );
}