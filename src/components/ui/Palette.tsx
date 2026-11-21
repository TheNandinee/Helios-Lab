"use client";

import { useLabStore, type ComponentType } from "@/store/useLabStore";
import { SPECS, clampToTable } from "@/components/bench/specs";

const ITEMS: ComponentType[] = ["mcu-8051", "arduino-uno", "esp32", "jetson-nano", "led", "button"];

function tidyBench() {
  const s = useLabStore.getState();
  let j = 0;
  for (const c of s.components) {
    let x: number, z: number;
    if (c.type === "oscilloscope") { x = -2.3; z = -0.85; }
    else { x = -1.2 + (j % 4) * 1.05; z = -0.7 + Math.floor(j / 4) * 0.85; j++; }
    const [cx, cz] = clampToTable(c.type, x, z);
    s.updateComponent(c.id, { position: [cx, 0, cz] });
  }
}

export default function Palette() {
  const addComponent = useLabStore((s) => s.addComponent);
  const role = useLabStore((s) => s.role);
  return (
    <div className="glass space-y-2 rounded-xl p-3">
      <h2 className="text-sm font-semibold text-slate-300">Components</h2>
      {ITEMS.map((t) => (
        <button
          key={t}
          onClick={() => addComponent(t)}
          className="block w-full rounded-md bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700"
        >
          + {SPECS[t].label}
        </button>
      ))}
      <button
        onClick={tidyBench}
        className="block w-full rounded-md border border-slate-600 px-3 py-2 text-left text-sm hover:bg-slate-800"
      >
        ⟲ Tidy bench
      </button>
      <p className="pt-1 text-xs text-slate-500">Drag parts to move · Role: {role}</p>
    </div>
  );
}