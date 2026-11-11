"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { webglAvailable } from "@/components/bench/glControl";
import BenchErrorBoundary from "@/components/bench/BenchErrorBoundary";
import SchematicView2D from "@/components/bench/SchematicView2D";

const Workbench = dynamic(() => import("@/components/bench/Workbench"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-slate-400">Loading 3D bench…</div>,
});

export default function BenchView() {
  const { viewMode, reason, setViewMode } = useLabStore(
    useShallow((s) => ({ viewMode: s.viewMode, reason: s.fallbackReason, setViewMode: s.setViewMode }))
  );

  useEffect(() => {
    if (!webglAvailable()) useLabStore.getState().setViewMode("2d", "WebGL is not available on this device");
  }, []);

  if (viewMode === "2d") {
    return (
      <div className="relative h-full">
        <SchematicView2D />
        <div className="glass absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-xs">
          <span className="text-amber-300">2D schematic fallback · {reason ?? "manual"}</span>
          <button onClick={() => setViewMode("3d")} className="rounded-full bg-sky-500 px-3 py-1 font-semibold text-slate-950">
            Retry 3D
          </button>
        </div>
      </div>
    );
  }

  return (
    <BenchErrorBoundary>
      <Workbench />
    </BenchErrorBoundary>
  );
}