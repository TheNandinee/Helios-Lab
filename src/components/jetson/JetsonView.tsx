"use client";

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { modelLatency, type JetsonConfig } from "@/sim/jetson";
import { publishMetrics } from "@/sim/controller";

const W = 640, H = 360;
const CLASS_COLORS: Record<string, string> = {
  person: "#f472b6", car: "#38bdf8", bicycle: "#a3e635", dog: "#fbbf24", truck: "#c084fc",
};

interface SceneObject { cls: string; x: number; y: number; w: number; h: number; vx: number; conf: number; phase: number; }
interface Detection extends SceneObject { score: number; }

function makeScene(): SceneObject[] {
  const horizon = H * 0.42;
  const spec: [string, number, number, number, number][] = [
    ["car", H * 0.66, 110, 48, 90],
    ["truck", H * 0.8, 150, 70, -60],
    ["car", H * 0.92, 120, 55, 130],
    ["person", horizon + 30, 20, 58, 22],
    ["person", horizon + 34, 20, 60, -16],
    ["bicycle", H * 0.6, 56, 38, 48],
    ["dog", horizon + 34, 38, 24, 30],
  ];
  return spec.map(([cls, y, w, h, vx], i) => ({
    cls, x: (i * 137) % W, y, w, h, vx, conf: 0.72 + ((i * 7) % 20) / 100, phase: i * 1.3,
  }));
}

function drawObject(ctx: CanvasRenderingContext2D, o: SceneObject) {
  const top = o.y - o.h;
  switch (o.cls) {
    case "car":
    case "truck":
      ctx.fillStyle = o.cls === "car" ? "#64748b" : "#78716c";
      ctx.fillRect(o.x, top + o.h * 0.3, o.w, o.h * 0.5);
      ctx.fillRect(o.x + o.w * 0.2, top, o.w * 0.55, o.h * 0.35);
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(o.x + o.w * 0.25, top + 4, o.w * 0.45, o.h * 0.22);
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(o.x + o.w * 0.22, o.y - 6, 9, 0, Math.PI * 2);
      ctx.arc(o.x + o.w * 0.78, o.y - 6, 9, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "person":
      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.arc(o.x + o.w / 2, top + 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#475569";
      ctx.fillRect(o.x + 3, top + 16, o.w - 6, o.h - 16);
      break;
    case "bicycle":
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(o.x + 12, o.y - 12, 11, 0, Math.PI * 2);
      ctx.moveTo(o.x + o.w - 1, o.y - 12);
      ctx.arc(o.x + o.w - 12, o.y - 12, 11, 0, Math.PI * 2);
      ctx.moveTo(o.x + 12, o.y - 12);
      ctx.lineTo(o.x + o.w / 2, top + 8);
      ctx.lineTo(o.x + o.w - 12, o.y - 12);
      ctx.stroke();
      break;
    case "dog":
      ctx.fillStyle = "#a16207";
      ctx.fillRect(o.x, top + 6, o.w * 0.75, o.h - 10);
      ctx.fillRect(o.x + o.w * 0.65, top, o.w * 0.35, o.h * 0.5);
      break;
  }
}

function drawScene(ctx: CanvasRenderingContext2D, lane: number, objects: SceneObject[]) {
  const horizon = H * 0.42;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#0f172a");
  sky.addColorStop(1, "#334155");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = "#1e293b";
  for (let i = 0; i < 8; i++) {
    const bw = 60 + ((i * 23) % 40), bh = 40 + ((i * 37) % 70);
    ctx.fillRect(i * 85, horizon - bh, bw, bh);
  }
  ctx.fillStyle = "#475569";
  ctx.fillRect(0, horizon, W, H * 0.1);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(0, horizon + H * 0.1, W, H);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 16]);
  ctx.lineDashOffset = -lane;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.75);
  ctx.lineTo(W, H * 0.75);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const o of objects) drawObject(ctx, o);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let i = 0; i < 150; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
}

function detect(objects: SceneObject[], config: JetsonConfig, t: number): Detection[] {
  return objects
    .filter((o) => config.classes.includes(o.cls) && o.x > -o.w / 2 && o.x + o.w / 2 < W)
    .map((o) => ({ ...o, score: Math.max(0, Math.min(0.99, o.conf + Math.sin(t / 600 + o.phase) * 0.15)) }))
    .filter((d) => d.score >= config.threshold);
}

export default function JetsonView() {
  const { running, config, stats } = useLabStore(
    useShallow((s) => ({
      running: s.simStatus === "running" && s.architecture === "jetson-nano",
      config: s.jetsonConfig,
      stats: s.jetsonStats,
    }))
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!running || !config) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const objects = makeScene();
    const frameInterval = 1000 / config.fps;
    let raf = 0, last = performance.now(), acc = 0, lane = 0;
    let lastStats = last, frames = 0, infSum = 0, detSum = 0, shownFps = config.fps, shownInf = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      acc += now - last;
      last = now;
      if (acc < frameInterval) return;
      const dt = Math.min(acc, 200) / 1000;
      acc = 0;

      lane = (lane + dt * 120) % 40;
      for (const o of objects) {
        o.x += o.vx * dt;
        if (o.x > W + 60) o.x = -o.w - 20;
        if (o.x < -o.w - 60) o.x = W + 20;
      }
      const inference = modelLatency(config.model) + (Math.random() - 0.5) * 6;
      drawScene(ctx, lane, objects);
      const dets = detect(objects, config, now);

      for (const d of dets) {
        const color = CLASS_COLORS[d.cls] ?? "#fff";
        const top = d.y - d.h;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(d.x - 4, top - 4, d.w + 8, d.h + 8);
        if (config.showLabels) {
          const label = `${d.cls} ${(d.score * 100).toFixed(0)}%`;
          ctx.font = "bold 12px monospace";
          const tw = ctx.measureText(label).width + 8;
          ctx.fillStyle = color;
          ctx.fillRect(d.x - 4, top - 22, tw, 18);
          ctx.fillStyle = "#0b1020";
          ctx.fillText(label, d.x, top - 8);
        }
      }

      ctx.fillStyle = "rgba(2,6,23,0.7)";
      ctx.fillRect(8, 8, 300, 40);
      ctx.fillStyle = "#a7f3d0";
      ctx.font = "12px monospace";
      ctx.fillText(`TensorRT FP16 · ${config.model}`, 16, 24);
      ctx.fillText(`${shownFps} FPS · ${shownInf.toFixed(1)} ms · ${dets.length} objects`, 16, 40);

      frames++;
      infSum += inference;
      detSum += dets.length;
      if (now - lastStats >= 1000) {
        const fps = Math.round((frames * 1000) / (now - lastStats));
        const inferenceMs = Number((infSum / frames).toFixed(1));
        const detections = Math.round(detSum / frames);
        shownFps = fps;
        shownInf = inferenceMs;
        const st = useLabStore.getState();
        st.setJetsonStats({ fps, inferenceMs, detections });
        publishMetrics({ fps, inference_ms: inferenceMs, detections });
        const gpu = Math.min(99, Math.round(inferenceMs * 2.4));
        st.appendSerial(
          `RAM ${1500 + Math.round(Math.random() * 300)}/3964MB CPU [${30 + Math.round(Math.random() * 20)}%@1479] GPU ${gpu}% temp ${(40 + gpu / 10).toFixed(1)}C | ${fps} FPS ${inferenceMs} ms ${detections} obj\n`
        );
        frames = 0; infSum = 0; detSum = 0; lastStats = now;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, config]);

  if (!running) return null;

  return (
    <div className="glass w-[560px] max-w-[90vw] space-y-1 rounded-2xl p-2 shadow-2xl">
      <div className="flex items-center justify-between px-1 text-xs">
        <span className="font-semibold text-lime-300">Jetson Nano · csi://0 → detectNet</span>
        <span className="font-mono text-slate-400">
          {stats ? `${stats.fps} FPS · ${stats.inferenceMs} ms · ${stats.detections} obj` : "warming up…"}
        </span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-lg" />
    </div>
  );
}