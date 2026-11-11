"use client";

import { useLabStore, type ComponentType } from "@/store/useLabStore";
import { SPECS } from "@/components/bench/specs";

const ITEMS: ComponentType[] = ["mcu-8051", "arduino-uno", "esp32", "jetson-nano", "led"];

export default function Palette() {
  const addComponent = useLabStore((s) => s.addComponent);
  const role = useLabStore((s) => s.role);
  return (
    <div className="glass rounded-xl p-3 space-y-2">
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
      <p className="pt-1 text-xs text-slate-500">Role: {role}</p>
    </div>
  );
}