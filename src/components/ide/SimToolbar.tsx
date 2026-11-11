"use client";

import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { runSimulation, stopSimulation, pause8051, resume8051, step8051 } from "@/sim/controller";
import { EXAMPLES, MAIN_FILE } from "@/sim/templates";

const STATUS_STYLE: Record<string, string> = {
  idle: "bg-slate-700 text-slate-300",
  compiling: "bg-amber-500/20 text-amber-300",
  running: "bg-emerald-500/20 text-emerald-300",
  paused: "bg-violet-500/20 text-violet-300",
  error: "bg-red-500/20 text-red-300",
};

export default function SimToolbar() {
  const s = useLabStore(
    useShallow((st) => ({
      simStatus: st.simStatus, simError: st.simError, buildMs: st.buildMs, architecture: st.architecture,
      autoFlash: st.autoFlash, setAutoFlash: st.setAutoFlash,
      scopeOpen: st.scopeOpen, setScopeOpen: st.setScopeOpen,
      registersOpen: st.registersOpen, setRegistersOpen: st.setRegistersOpen,
      setFile: st.setFile,
    }))
  );
  const active = s.simStatus === "running" || s.simStatus === "compiling" || s.simStatus === "paused";
  const is8051 = s.architecture === "8051";

  function loadExample(index: string) {
    const ex = EXAMPLES[s.architecture][Number(index)];
    if (!ex) return;
    stopSimulation();
    s.setFile(MAIN_FILE[s.architecture], ex.code);
  }

  const btn = "rounded-md px-3 py-1.5 text-sm disabled:opacity-40";

  return (
    <div className="glass space-y-2 rounded-xl p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => runSimulation()}
          disabled={s.simStatus === "compiling"}
          className={`${btn} bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400`}
        >
          ▶ Run
        </button>
        <button onClick={stopSimulation} disabled={!active} className={`${btn} border border-slate-600 hover:bg-slate-800`}>
          ■ Stop
        </button>
        {is8051 && (
          <>
            {s.simStatus === "paused" ? (
              <button onClick={resume8051} className={`${btn} bg-slate-800`}>⏵ Resume</button>
            ) : (
              <button onClick={pause8051} disabled={s.simStatus !== "running"} className={`${btn} bg-slate-800`}>⏸ Pause</button>
            )}
            <button onClick={step8051} disabled={!active} className={`${btn} bg-slate-800`}>Step</button>
          </>
        )}
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[s.simStatus]}`}>{s.simStatus}</span>
        <span className="ml-auto text-xs text-slate-400">
          {s.architecture}{s.buildMs !== null && ` · build ${s.buildMs} ms`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <select
          value=""
          onChange={(e) => loadExample(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
        >
          <option value="">Load example…</option>
          {EXAMPLES[s.architecture].map((ex, i) => <option key={ex.name} value={i}>{ex.name}</option>)}
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={s.autoFlash} onChange={(e) => s.setAutoFlash(e.target.checked)} />
          Live re-flash on edit
        </label>
        <button
          onClick={() => s.setScopeOpen(!s.scopeOpen)}
          className={`rounded px-2 py-1 ${s.scopeOpen ? "bg-sky-500 text-slate-950" : "bg-slate-800"}`}
        >
          Scope
        </button>
        {is8051 && (
          <button
            onClick={() => s.setRegistersOpen(!s.registersOpen)}
            className={`rounded px-2 py-1 ${s.registersOpen ? "bg-sky-500 text-slate-950" : "bg-slate-800"}`}
          >
            Registers
          </button>
        )}
      </div>

      {s.simError && (
        <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-red-950/40 p-2 text-xs text-red-300">{s.simError}</pre>
      )}
    </div>
  );
}