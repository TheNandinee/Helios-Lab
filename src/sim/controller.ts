import { useLabStore } from "@/store/useLabStore";
import { AvrRunner } from "@/sim/avr/AvrRunner";
import { Runner8051 } from "@/sim/i8051/Runner8051";
import { assemble } from "@/sim/i8051/assembler";
import { parseJetsonConfig, type JetsonConfig } from "@/sim/jetson";
import { MAIN_FILE } from "@/sim/templates";
import { simTrace } from "@/sim/trace";
import { createTelemetryPublisher, type TelemetryPublisher } from "@/lib/telemetry";

let avr: AvrRunner | null = null;
let m51: Runner8051 | null = null;
let publisher: TelemetryPublisher | null = null;
let runCounter = 0;
let liveSession = false;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

// ---- firmware cache (memory + localStorage) so edits back to known code and offline runs are instant ----
const hexMemo = new Map<string, string>();

function hashSource(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
function getCachedHex(src: string): string | null {
  const key = `helios:hex:${hashSource(src)}`;
  const mem = hexMemo.get(key);
  if (mem) return mem;
  try {
    const stored = localStorage.getItem(key);
    if (stored) { hexMemo.set(key, stored); return stored; }
  } catch { /* storage unavailable */ }
  return null;
}
function putCachedHex(src: string, hex: string) {
  const key = `helios:hex:${hashSource(src)}`;
  hexMemo.set(key, hex);
  try { localStorage.setItem(key, hex); } catch { /* storage full or unavailable */ }
}

function handlePins(changes: Record<string, number>) {
  useLabStore.getState().setPins(changes);
  publisher?.push(changes);
}

function haltRunners() {
  runCounter++;
  avr?.stop();
  m51?.stop();
  publisher?.stop();
  publisher = null;
}

export function stopSimulation() {
  liveSession = false;
  haltRunners();
  const s = useLabStore.getState();
  if (s.simStatus !== "idle" && s.simStatus !== "error") s.setSimStatus("idle");
}

/** Buttons pull their pin LOW while pressed */
export function setButtonInput(pin: string, pressed: boolean) {
  const s = useLabStore.getState();
  const value = pressed ? 0 : 1;
  if (s.architecture === "arduino-uno" && avr) {
    avr.setInput(pin, value === 1);
  } else if (s.architecture === "8051" && m51) {
    const m = /^P(\d)\.(\d)$/.exec(pin);
    if (!m) return;
    m51.setInput(Number(m[1]), Number(m[2]), value);
  } else {
    return;
  }
  simTrace.record(pin, value, simTrace.now);
  handlePins({ [pin]: value });
}

function releaseAllButtons() {
  for (const c of useLabStore.getState().components) {
    if (c.type === "button" && c.pin) setButtonInput(c.pin, false);
  }
}

function jetsonBootLog(c: JetsonConfig) {
  return [
    "[    0.000000] Booting Linux on physical CPU 0x0 (NVIDIA Jetson Nano, L4T R32.7)",
    "[    1.204311] tegra-camera: CSI port 0 -> imx219 sensor detected (virtual)",
    `[    2.881920] TensorRT: loading ${c.model} (FP16 engine)`,
    `[    3.402117] detectNet: threshold=${c.threshold} classes=[${c.classes.join(", ")}]`,
    `[    3.402500] videoSource csi://0 @ ${c.fps} FPS -> display://0`,
    "",
  ].join("\n");
}

export async function runSimulation() {
  haltRunners();
  liveSession = true;
  const myRun = runCounter;
  const s = useLabStore.getState();
  s.resetPins();
  s.clearSerial();
  s.setBuildMs(null);
  s.setJetsonStats(null);
  simTrace.clear();
  const source = s.files[MAIN_FILE[s.architecture]] ?? "";

  if (s.user) {
    publisher = createTelemetryPublisher({
      streamId: s.projectId ?? `scratch_${s.user.uid}`,
      ownerUid: s.user.uid,
      projectId: s.projectId ?? "scratch",
      onAck: (ms) => useLabStore.getState().setTelemetryLatency(ms),
    });
  }

  try {
    switch (s.architecture) {
      case "arduino-uno": {
        let hex = getCachedHex(source);
        if (hex) {
          s.appendSerial("[build] using cached firmware\n");
          s.setBuildMs(0);
        } else {
          s.setSimStatus("compiling");
          const t0 = performance.now();
          let res: Response;
          try {
            res = await fetch("/api/compile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sketch: source }),
            });
          } catch {
            throw new Error("Network unavailable and there is no cached build for this exact code. Reconnect, or undo your last edit to run the cached version.");
          }
          const data = (await res.json()) as { hex?: string; stderr?: string; stdout?: string; error?: string };
          if (myRun !== runCounter) return;
          useLabStore.getState().setBuildMs(Math.round(performance.now() - t0));
          if (!res.ok || !data.hex) throw new Error(data.error || data.stderr || data.stdout || "Compilation failed");
          hex = data.hex;
          putCachedHex(source, hex);
        }
        avr ??= new AvrRunner();
        avr.onPins = handlePins;
        avr.onSerial = (t) => useLabStore.getState().appendSerial(t);
        avr.start(hex);
        releaseAllButtons();
        useLabStore.getState().setSimStatus("running");
        break;
      }
      case "8051": {
        const result = assemble(source);
        if (result.errors.length) {
          throw new Error(result.errors.map((e) => `Line ${e.line}: ${e.message}`).join("\n"));
        }
        s.appendSerial(`[asm] ${result.size} bytes assembled, running at 12 MHz\n`);
        m51 ??= new Runner8051();
        m51.onPins = handlePins;
        m51.onHalt = (msg) => {
          publisher?.stop();
          publisher = null;
          useLabStore.getState().setSimStatus("error", msg);
        };
        m51.start(result.image);
        releaseAllButtons();
        s.setSimStatus("running");
        break;
      }
      case "jetson-nano": {
        const config = parseJetsonConfig(source);
        s.setJetsonConfig(config);
        s.appendSerial(jetsonBootLog(config));
        s.setSimStatus("running");
        break;
      }
      case "esp32":
        throw new Error("ESP32 firmware runs inside the Wokwi panel. Generate a device key in the ESP32 panel, paste the sketch into Wokwi, then press play there.");
    }
  } catch (err) {
    publisher?.stop();
    publisher = null;
    useLabStore.getState().setSimStatus("error", err instanceof Error ? err.message : String(err));
  }
}

// ---- 8051 debugging ----
export function pause8051() { if (!m51) return; m51.pause(); useLabStore.getState().setSimStatus("paused"); }
export function resume8051() { if (!m51) return; m51.resume(); useLabStore.getState().setSimStatus("running"); }
export function step8051() { if (!m51) return; m51.stepOnce(); if (useLabStore.getState().simStatus !== "error") useLabStore.getState().setSimStatus("paused"); }
export function get8051Cpu() { return m51?.cpu ?? null; }

/** Jetson vision tier pushes its metrics through the same telemetry stream */
export function publishMetrics(metrics: Record<string, number>) {
  publisher?.push(metrics);
}

/** Live re-flash: re-run automatically after code edits while a session is live */
export function initAutoFlash(): () => void {
  const unsub = useLabStore.subscribe((state, prev) => {
    if (state.files === prev.files || !state.autoFlash || !liveSession) return;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashTimer = null;
      if (liveSession) runSimulation();
    }, state.architecture === "arduino-uno" ? 1500 : 500);
  });
  return () => {
    unsub();
    if (flashTimer) clearTimeout(flashTimer);
  };
}