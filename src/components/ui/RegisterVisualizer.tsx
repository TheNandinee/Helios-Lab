"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { get8051Cpu, pause8051, resume8051, step8051 } from "@/sim/controller";
import type { Registers8051 } from "@/sim/i8051/core";

const hex = (v: number, w = 2) => v.toString(16).toUpperCase().padStart(w, "0");
const bin = (v: number) => v.toString(2).padStart(8, "0");
const PSW_BITS = ["CY", "AC", "F0", "RS1", "RS0", "OV", "–", "P"];

function Reg({ name, value, width = 2 }: { name: string; value: number; width?: number }) {
  return (
    <div className="rounded-lg bg-slate-900/70 px-2 py-1">
      <div className="text-[10px] text-slate-500">{name}</div>
      <div className="font-mono text-sm text-sky-300">{hex(value, width)}h</div>
      {width === 2 && <div className="font-mono text-[10px] text-slate-500">{bin(value)} · {value}</div>}
    </div>
  );
}

export default function RegisterVisualizer() {
  const { open, setOpen, architecture, simStatus } = useLabStore(
    useShallow((s) => ({
      open: s.registersOpen, setOpen: s.setRegistersOpen, architecture: s.architecture, simStatus: s.simStatus,
    }))
  );
  const [regs, setRegs] = useState<Registers8051 | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      const cpu = get8051Cpu();
      setRegs(cpu ? cpu.registers() : null);
    }, 100);
    return () => clearInterval(id);
  }, [open]);

  if (!open || architecture !== "8051") return null;

  const bank = regs ? (regs.psw >> 3) & 3 : 0;

  return (
    <div className="glass w-[420px] max-w-[92vw] space-y-2 rounded-2xl p-3 text-xs shadow-2xl">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sky-300">8051 CPU registers</span>
        <span className="text-slate-500">{regs ? `${regs.cycles.toLocaleString()} cycles${regs.inIsr ? " · in ISR" : ""}` : "not running"}</span>
        <div className="ml-auto flex gap-1">
          {simStatus === "paused"
            ? <button onClick={resume8051} className="rounded bg-slate-800 px-2 py-0.5">⏵</button>
            : <button onClick={pause8051} className="rounded bg-slate-800 px-2 py-0.5">⏸</button>}
          <button onClick={step8051} className="rounded bg-slate-800 px-2 py-0.5">Step</button>
          <button onClick={() => setOpen(false)} className="px-1 text-slate-400 hover:text-white">✕</button>
        </div>
      </div>

      {!regs ? (
        <p className="text-slate-400">Press Run to start the 8051.</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1">
            <Reg name="ACC" value={regs.a} />
            <Reg name="B" value={regs.b} />
            <Reg name="SP" value={regs.sp} />
            <Reg name="PSW" value={regs.psw} />
            <Reg name="DPTR" value={regs.dptr} width={4} />
            <Reg name="PC" value={regs.pc} width={4} />
            <Reg name="TH0:TL0" value={(regs.th0 << 8) | regs.tl0} width={4} />
            <Reg name="TH1:TL1" value={(regs.th1 << 8) | regs.tl1} width={4} />
          </div>

          <div className="flex gap-1">
            {PSW_BITS.map((name, i) => {
              const on = (regs.psw >> (7 - i)) & 1;
              return (
                <span key={name + i} className={`flex-1 rounded py-0.5 text-center font-mono ${on ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-900/70 text-slate-500"}`}>
                  {name}
                </span>
              );
            })}
          </div>

          <div>
            <div className="mb-1 text-[10px] text-slate-500">Register bank {bank}</div>
            <div className="grid grid-cols-8 gap-1">
              {regs.r.map((v, i) => (
                <div key={i} className="rounded bg-slate-900/70 py-1 text-center font-mono">
                  <div className="text-[10px] text-slate-500">R{i}</div>
                  <div className="text-sky-300">{hex(v)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            {regs.pins.map((v, p) => (
              <div key={p} className="flex items-center gap-2 font-mono">
                <span className="w-6 text-slate-400">P{p}</span>
                {Array.from({ length: 8 }, (_, b) => 7 - b).map((b) => (
                  <span key={b} title={`P${p}.${b}`} className={`h-3 w-3 rounded-full ${(v >> b) & 1 ? "bg-amber-400" : "bg-slate-700"}`} />
                ))}
                <span className="text-slate-500">{hex(v)}h</span>
              </div>
            ))}
          </div>

          <div className="font-mono text-[10px] text-slate-500">
            TCON {hex(regs.tcon)}h · TMOD {hex(regs.tmod)}h · IE {hex(regs.ie)}h
          </div>
        </>
      )}
    </div>
  );
}