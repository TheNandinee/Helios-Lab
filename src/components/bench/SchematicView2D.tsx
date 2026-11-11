"use client";

import { useEffect, useRef } from "react";
import { useLabStore, type BenchComponent } from "@/store/useLabStore";
import { SPECS } from "@/components/bench/specs";
import { setButtonInput } from "@/sim/controller";

const BENCH_W = 6, BENCH_D = 3;
interface Hit { x: number; y: number; w: number; h: number; comp: BenchComponent; }

export default function SchematicView2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hits = useRef<Hit[]>([]);
  const pressedPin = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !wrap || !ctx) return;
    let raf = 0, dirty = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    const unsub = useLabStore.subscribe(() => { dirty = true; });

    const render = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const s = useLabStore.getState();
      const scale = Math.min(w / (BENCH_W + 0.6), h / (BENCH_D + 0.6));
      const cx = w / 2, cy = h / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(56,189,248,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - (BENCH_W / 2) * scale, cy - (BENCH_D / 2) * scale, BENCH_W * scale, BENCH_D * scale);

      const newHits: Hit[] = [];
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      for (const c of s.components) {
        const spec = SPECS[c.type];
        const x = cx + c.position[0] * scale, y = cy + c.position[2] * scale;
        const pw = Math.max(16, spec.size[0] * scale), ph = Math.max(16, spec.size[2] * scale);
        const value = c.pin ? s.pinStates[c.pin] : undefined;
        const selected = s.selectedId === c.id;

        if (c.type === "led" || c.type === "button") {
          const on = c.type === "led" && value !== undefined && (c.activeLow ? value === 0 : value === 1);
          const pressed = c.type === "button" && value === 0;
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2);
          ctx.fillStyle = c.type === "led" ? (on ? (c.color ?? "#ef4444") : "#3f1d1d") : pressed ? "#94a3b8" : "#475569";
          ctx.shadowColor = c.color ?? "#ef4444";
          ctx.shadowBlur = on ? 24 : 0;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = spec.color;
          ctx.fillRect(x - pw / 2, y - ph / 2, pw, ph);
        }
        ctx.strokeStyle = selected ? "#38bdf8" : "#94a3b8";
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(x - pw / 2 - 3, y - ph / 2 - 3, pw + 6, ph + 6);
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`${spec.label}${c.pin ? ` (${c.pin})` : ""}`, x, y + ph / 2 + 16);
        newHits.push({ x: x - pw / 2 - 3, y: y - ph / 2 - 3, w: pw + 6, h: ph + 6, comp: c });
      }
      hits.current = newHits;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!dirty) return;
      dirty = false;
      render();
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); unsub(); };
  }, []);

  function hitAt(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    for (let i = hits.current.length - 1; i >= 0; i--) {
      const h = hits.current[i];
      if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) return h.comp;
    }
    return null;
  }

  function release() {
    if (pressedPin.current) setButtonInput(pressedPin.current, false);
    pressedPin.current = null;
  }

  return (
    <div ref={wrapRef} className="h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        onPointerDown={(e) => {
          const c = hitAt(e);
          useLabStore.getState().select(c?.id ?? null);
          if (c?.type === "button" && c.pin) { pressedPin.current = c.pin; setButtonInput(c.pin, true); }
        }}
        onPointerUp={release}
        onPointerLeave={release}
      />
    </div>
  );
}