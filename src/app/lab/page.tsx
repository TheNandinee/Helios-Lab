"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { useShallow } from "zustand/react/shallow";
import { auth } from "@/lib/firebase";
import { useLabStore } from "@/store/useLabStore";
import { subscribeTelemetry } from "@/lib/telemetry";
import { initAutoFlash, stopSimulation } from "@/sim/controller";
import { cloudTrace } from "@/sim/trace";
import Palette from "@/components/ui/Palette";
import ComponentConfigModal from "@/components/ui/ComponentConfigModal";
import TelemetryHud from "@/components/ui/TelemetryHud";
import ProjectBar from "@/components/ide/ProjectBar";
import SimToolbar from "@/components/ide/SimToolbar";
import SerialConsole from "@/components/ide/SerialConsole";
import Oscilloscope from "@/components/scope/Oscilloscope";
import JetsonView from "@/components/jetson/JetsonView";
import Esp32Panel from "@/components/sim/Esp32Panel";

const Workbench = dynamic(() => import("@/components/bench/Workbench"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-slate-400">Loading 3D bench…</div>,
});
const CodeEditor = dynamic(() => import("@/components/ide/CodeEditor"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-slate-400">Loading editor…</div>,
});

export default function LabPage() {
  const { user, role, authReady, architecture, projectId } = useLabStore(
    useShallow((s) => ({
      user: s.user, role: s.role, authReady: s.authReady, architecture: s.architecture, projectId: s.projectId,
    }))
  );

  useEffect(() => () => stopSimulation(), []);
  useEffect(() => initAutoFlash(), []);

  useEffect(() => {
    if (!user) return;
    const streamId = projectId ?? `scratch_${user.uid}`;
    let prev: Record<string, number> = {};
    return subscribeTelemetry(streamId, (pins) => {
      const now = performance.now() / 1000;
      for (const [pin, v] of Object.entries(pins)) if (prev[pin] !== v) cloudTrace.record(pin, v, now);
      prev = pins;
      useLabStore.getState().setRemotePins(pins);
    });
  }, [user, projectId]);

  if (!authReady) {
    return <div className="flex h-screen items-center justify-center text-slate-400">Connecting…</div>;
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <Link href="/" className="font-bold">Helios <span className="text-sky-400">Lab</span></Link>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-slate-400">{user.email} · <span className="text-sky-300">{role}</span></span>
              <button
                onClick={() => { stopSimulation(); signOut(auth); }}
                className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <span className="text-amber-300">Guest demo mode (nothing is saved)</span>
              <Link href="/login" className="rounded bg-sky-500 px-3 py-1 text-slate-950">Sign in</Link>
            </>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_480px]">
        <section className="relative min-h-[50vh]">
          <Workbench />
          <div className="absolute left-3 top-3"><Palette /></div>
          <div className="absolute right-3 top-3"><ComponentConfigModal /></div>
          <div className="absolute left-1/2 top-3 -translate-x-1/2"><JetsonView /></div>
          <div className="absolute bottom-3 left-3"><TelemetryHud /></div>
          <div className="absolute bottom-3 right-3"><Oscilloscope /></div>
        </section>

        <aside className="flex min-h-0 flex-col gap-2 overflow-auto border-l border-slate-800 p-3">
          <ProjectBar />
          <SimToolbar />
          <div className="min-h-[260px] flex-1 overflow-hidden rounded-xl border border-slate-800">
            <CodeEditor />
          </div>
          {architecture === "esp32" ? <Esp32Panel key={projectId ?? "scratch"} /> : <SerialConsole />}
        </aside>
      </div>
    </div>
  );
}