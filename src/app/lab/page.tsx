"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLabStore } from "@/store/useLabStore";
import Palette from "@/components/ui/Palette";
import Inspector from "@/components/ui/Inspector";
import WokwiPanel from "@/components/sim/WokwiPanel";

const Workbench = dynamic(() => import("@/components/bench/Workbench"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-slate-400">Loading 3D bench…</div>,
});

export default function LabPage() {
  const { user, role, authReady } = useLabStore();

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
              <button onClick={() => signOut(auth)} className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">
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

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_420px] overflow-hidden">
        <section className="relative">
          <Workbench />
          <div className="absolute left-3 top-3"><Palette /></div>
          <div className="absolute right-3 top-3"><Inspector /></div>
        </section>
        <aside className="border-l border-slate-800 p-3 overflow-auto">
          <WokwiPanel />
        </aside>
      </div>
    </div>
  );
}