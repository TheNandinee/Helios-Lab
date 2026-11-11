"use client";

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore, type Architecture } from "@/store/useLabStore";
import { simTrace, cloudTrace, type PinTrace } from "@/sim/trace";
import { PIN_OPTIONS, VREF } from "@/sim/templates";

const TIMEBASES = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]; // ms/div
const VOLT_SCALES = [0.5, 1, 2, 5, 10, 20, 50];
const DIV_X = 10, DIV_Y = 8, W = 640, H = 320;
const COLORS = ["#facc15", "#22d3ee"];
const ESP32_FIELDS = ["GPIO2", "voltage", "temperature", "adc_raw"];
const JETSON_FIELDS = ["fps", "inference_ms", "detections"];

interface Measure { freq: number | null; duty: number | null; last: number | null; }
const EMPTY: Measure = { freq: null, duty: null, last: null };

const isDigitalPin = (p: string) => /^(D\d+|A\d+|P\d\.\d|GPIO\d+)$/.test(p);

function drawChannel(
  ctx: CanvasRenderingContext2D, trace: PinTrace | undefined, t0: number, t1: number,
  scale: number, vPerDiv: number, baseline: number, color: string
): Measure {
  const divH = H / DIV_Y;
  const xOf = (t: number) => ((t - t0) / (t1 - t0)) * W;
  const yOf = (v: number) => baseline - ((v * scale) / vPerDiv) * divH;

  ctx.fillStyle = color;
  ctx.fillRect(0, baseline - 1, 8, 2);
  if (!trace || trace.count === 0) return EMPTY;

  let cur: number | null = null;
  let startT = t0, lastT = t0, highTime = 0;
  const rises: number[] = [];
  let started = false;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < trace.count; i++) {
    const t = trace.timeAt(i), v = trace.valueAt(i);
    if (t <= t0) { cur = v; continue; }
    if (t > t1) break;
    if (cur === null) {
      cur = v; startT = t; lastT = t;
      ctx.moveTo(xOf(t), yOf(v));
      started = true;
      continue;
    }
    if (!started) { ctx.moveTo(0, yOf(cur)); started = true; }
    ctx.lineTo(xOf(t), yOf(cur));
    ctx.lineTo(xOf(t), yOf(v));
    if (cur >= 0.5) highTime += t - lastT;
    if (cur < 0.5 && v >= 0.5) rises.push(t);
    lastT = t;
    cur = v;
  }
  if (cur !== null) {
    if (!started) ctx.moveTo(0, yOf(cur));
    ctx.lineTo(W, yOf(cur));
    if (cur >= 0.5) highTime += t1 - lastT;
  }
  ctx.stroke();

  const span = t1 - startT;
  return {
    freq: rises.length >= 2 ? (rises.length - 1) / (rises[rises.length - 1] - rises[0]) : null,
    duty: span > 0 && cur !== null ? (highTime / span) * 100 : null,
    last: cur,
  };
}

function formatFreq(f: number | null) {
  if (f === null || !isFinite(f)) return "–";
  return f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : `${f.toFixed(1)} Hz`;
}

function ScopePanel({ architecture, onClose }: { architecture: Architecture; onClose: () => void }) {
  const options =
    architecture === "esp32" ? ESP32_FIELDS : architecture === "jetson-nano" ? JETSON_FIELDS : PIN_OPTIONS[architecture];
  const [channels, setChannels] = useState<[string, string]>(
    architecture === "8051" ? ["P1.0", "P1.1"]
    : architecture === "esp32" ? ["GPIO2", "voltage"]
    : architecture === "jetson-nano" ? ["fps", "inference_ms"]
    : ["D13", "D9"]
  );
  const [source, setSource] = useState<"sim" | "cloud">(
    architecture === "esp32" || architecture === "jetson-nano" ? "cloud" : "sim"
  );
  const [msPerDiv, setMsPerDiv] = useState(architecture === "esp32" ? 1000 : 100);
  const [vPerDiv, setVPerDiv] = useState(architecture === "jetson-nano" ? 10 : 2);
  const [hold, setHold] = useState(false);
  const [measures, setMeasures] = useState<Measure[]>([EMPTY, EMPTY]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<Measure[]>([EMPTY, EMPTY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vref = VREF[architecture];
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (hold) return;
      const store = source === "sim" ? simTrace : cloudTrace;
      const now = source === "sim" ? simTrace.now : performance.now() / 1000;
      const span = (msPerDiv * DIV_X) / 1000;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < DIV_X; i++) { const x = (W / DIV_X) * i; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let j = 1; j < DIV_Y; j++) { const y = (H / DIV_Y) * j; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();

      const baselines = [H * 0.45, H * 0.92];
      measureRef.current = channels.map((pin, i) =>
        drawChannel(ctx, store.get(pin), now - span, now, isDigitalPin(pin) ? vref : 1, vPerDiv, baselines[i], COLORS[i])
      );
    };
    raf = requestAnimationFrame(draw);
    const iv = setInterval(() => setMeasures([...measureRef.current]), 250);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); };
  }, [channels, source, msPerDiv, vPerDiv, hold, architecture]);

  const sel = "rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs";

  return (
    <div className="glass w-[680px] max-w-[95vw] space-y-2 rounded-2xl p-3 shadow-2xl">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-sky-300">Virtual Oscilloscope</span>
        <select className={sel} value={source} onChange={(e) => setSource(e.target.value as "sim" | "cloud")}>
          <option value="sim">Source: simulator</option>
          <option value="cloud">Source: Firebase RTDB</option>
        </select>
        <select className={sel} value={msPerDiv} onChange={(e) => setMsPerDiv(Number(e.target.value))}>
          {TIMEBASES.map((t) => <option key={t} value={t}>{t} ms/div</option>)}
        </select>
        <select className={sel} value={vPerDiv} onChange={(e) => setVPerDiv(Number(e.target.value))}>
          {VOLT_SCALES.map((v) => <option key={v} value={v}>{v} V/div</option>)}
        </select>
        <button onClick={() => setHold(!hold)} className={`rounded px-2 py-0.5 ${hold ? "bg-amber-500 text-slate-950" : "bg-slate-800"}`}>
          {hold ? "HOLD" : "RUN"}
        </button>
        <button onClick={onClose} className="ml-auto text-slate-400 hover:text-white">✕</button>
      </div>

      <canvas ref={canvasRef} style={{ width: "100%", aspectRatio: `${W} / ${H}` }} className="rounded-lg" />

      <div className="grid grid-cols-2 gap-2 text-xs">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-900/60 p-2">
            <span style={{ color: COLORS[i] }} className="font-bold">CH{i + 1}</span>
            <select
              className={sel}
              value={channels[i]}
              onChange={(e) => setChannels(i === 0 ? [e.target.value, channels[1]] : [channels[0], e.target.value])}
            >
              {options.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="font-mono text-slate-300">
              {measures[i].last === null ? "–"
                : isDigitalPin(channels[i]) ? `${(measures[i].last! * VREF[architecture]).toFixed(2)} V`
                : measures[i].last!.toFixed(2)}
            </span>
            {isDigitalPin(channels[i]) && (
              <span className="font-mono text-slate-400">
                f {formatFreq(measures[i].freq)} · duty {measures[i].duty === null ? "–" : `${measures[i].duty!.toFixed(0)}%`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Oscilloscope() {
  const { open, setScopeOpen, architecture } = useLabStore(
    useShallow((s) => ({ open: s.scopeOpen, setScopeOpen: s.setScopeOpen, architecture: s.architecture }))
  );
  if (!open) return null;
  return <ScopePanel key={architecture} architecture={architecture} onClose={() => setScopeOpen(false)} />;
}