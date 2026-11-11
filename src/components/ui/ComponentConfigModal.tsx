"use client";

import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { SPECS, BOARD_ARCH, BOARD_NOTES } from "@/components/bench/specs";
import { PIN_OPTIONS } from "@/sim/templates";
import { stopSimulation } from "@/sim/controller";

export default function ComponentConfigModal() {
  const s = useLabStore(
    useShallow((st) => {
      const item = st.components.find((c) => c.id === st.selectedId);
      return {
        item,
        architecture: st.architecture,
        pinValue: item?.pin ? st.pinStates[item.pin] : undefined,
        select: st.select,
        removeComponent: st.removeComponent,
        updateComponent: st.updateComponent,
        setArchitecture: st.setArchitecture,
        setScopeOpen: st.setScopeOpen,
      };
    })
  );
  const item = s.item;
  if (!item) return null;

  const spec = SPECS[item.type];
  const boardArch = BOARD_ARCH[item.type];
  const pins = PIN_OPTIONS[s.architecture];
  const wired = item.type === "led" || item.type === "button";

  return (
    <div className="glass w-72 space-y-3 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sky-300">{spec.label}</h2>
        <button onClick={() => s.select(null)} className="text-slate-400 hover:text-white">✕</button>
      </div>

      {boardArch && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">{BOARD_NOTES[item.type]}</p>
          {boardArch === s.architecture ? (
            <p className="text-sm text-emerald-300">✓ Active board</p>
          ) : (
            <button
              onClick={() => { stopSimulation(); s.setArchitecture(boardArch); }}
              className="w-full rounded-md bg-sky-500 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
            >
              Use this board
            </button>
          )}
        </div>
      )}

      {wired && (
        <div className="space-y-2 text-sm">
          {pins.length > 0 ? (
            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Wired to pin</span>
              <select
                value={item.pin ?? ""}
                onChange={(e) => s.updateComponent(item.id, { pin: e.target.value })}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
              >
                {pins.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          ) : (
            <p className="text-xs text-amber-300">This board&apos;s pins are simulated inside Wokwi.</p>
          )}

          {item.type === "led" && (
            <>
              <label className="flex items-center justify-between">
                <span className="text-slate-300">Colour</span>
                <input
                  type="color"
                  value={item.color ?? "#ef4444"}
                  onChange={(e) => s.updateComponent(item.id, { color: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!item.activeLow}
                  onChange={(e) => s.updateComponent(item.id, { activeLow: e.target.checked })}
                />
                <span className="text-slate-300">Active-low (lights when pin = 0)</span>
              </label>
            </>
          )}
          {item.type === "button" && (
            <p className="text-xs text-slate-400">Hold the mouse on the button to press it. Pressed pulls the pin LOW (pull-up wiring).</p>
          )}
          <p className="text-xs text-slate-400">Live pin value: {s.pinValue ?? "–"}</p>
        </div>
      )}

      {item.type === "oscilloscope" && (
        <button
          onClick={() => s.setScopeOpen(true)}
          className="w-full rounded-md bg-sky-500 py-1.5 text-sm font-semibold text-slate-950"
        >
          Open oscilloscope
        </button>
      )}

      <button
        onClick={() => s.removeComponent(item.id)}
        className="w-full rounded-md bg-red-500/20 py-1.5 text-sm text-red-300 hover:bg-red-500/30"
      >
        Remove from bench
      </button>
    </div>
  );
}