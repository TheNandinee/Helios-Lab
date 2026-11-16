"use client";
import { Cpu, Zap, Monitor, Circle, ToggleLeft, CircuitBoard } from 'lucide-react';
import { useLabStore, type ComponentType } from "@/store/useLabStore";
import { SPECS } from "@/components/bench/specs";

const ITEMS: ComponentType[] = ["mcu-8051", "arduino-uno", "esp32", "jetson-nano", "led", "button"];

const getIcon = (type: string) => {
  switch (type) {
    case "led": return <Circle size={16} className="text-red-500" />;
    case "button": return <ToggleLeft size={16} className="text-purple-500" />;
    case "mcu-8051": 
    case "arduino-uno": 
    case "esp32": 
    case "jetson-nano": return <Cpu size={16} className="text-sky-500" />;
    default: return <CircuitBoard size={16} className="text-slate-400" />;
  }
};

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
          className="flex items-center gap-2 w-full rounded-md bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors"
        >
          {/* Yahan icon aa raha hai */}
          {getIcon(t)} 
          <span>+ {SPECS[t].label}</span>
        </button>
      ))}
      <p className="pt-1 text-xs text-slate-500">Role: {role}</p>
    </div>
  );
}