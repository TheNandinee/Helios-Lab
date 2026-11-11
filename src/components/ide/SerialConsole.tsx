"use client";

import { useEffect, useRef } from "react";
import { useLabStore } from "@/store/useLabStore";

export default function SerialConsole() {
  const serial = useLabStore((s) => s.serial);
  const clearSerial = useLabStore((s) => s.clearSerial);
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    ref.current?.scrollTo(0, ref.current.scrollHeight);
  }, [serial]);

  return (
    <div className="glass flex h-40 flex-col rounded-xl p-2">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-300">Serial monitor</h2>
        <button onClick={clearSerial} className="text-xs text-slate-400 hover:text-white">Clear</button>
      </div>
      <pre ref={ref} className="flex-1 overflow-auto whitespace-pre-wrap rounded bg-black/60 p-2 font-mono text-[11px] text-green-400">
        {serial || "Serial output appears here…"}
      </pre>
    </div>
  );
}