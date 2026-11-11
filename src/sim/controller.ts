import { useLabStore } from "@/store/useLabStore";
import { AvrRunner } from "@/sim/avr/AvrRunner";
import { Runner8051 } from "@/sim/i8051/Runner8051";
import { assemble } from "@/sim/i8051/assembler";
import { MAIN_FILE } from "@/sim/templates";
import { createTelemetryPublisher, type TelemetryPublisher } from "@/lib/telemetry";

let avr: AvrRunner | null = null;
let m51: Runner8051 | null = null;
let publisher: TelemetryPublisher | null = null;
let runCounter = 0;

function handlePins(changes: Record<string, number>) {
  useLabStore.getState().setPins(changes);
  publisher?.push(changes);
}

export function stopSimulation() {
  runCounter++;
  avr?.stop();
  m51?.stop();
  publisher?.stop();
  publisher = null;
  const s = useLabStore.getState();
  if (s.simStatus === "running" || s.simStatus === "compiling") s.setSimStatus("idle");
}

export async function runSimulation() {
  stopSimulation();
  const myRun = runCounter;
  const s = useLabStore.getState();
  s.resetPins();
  s.clearSerial();
  s.setBuildMs(null);
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
    if (s.architecture === "arduino-uno") {
      s.setSimStatus("compiling");
      const t0 = performance.now();
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sketch: source }),
      });
      const data = (await res.json()) as { hex?: string; stderr?: string; stdout?: string; error?: string };
      if (myRun !== runCounter) return; // user pressed Stop while compiling
      useLabStore.getState().setBuildMs(Math.round(performance.now() - t0));
      if (!res.ok || !data.hex) throw new Error(data.error || data.stderr || data.stdout || "Compilation failed");

      avr ??= new AvrRunner();
      avr.onPins = handlePins;
      avr.onSerial = (t) => useLabStore.getState().appendSerial(t);
      avr.start(data.hex);
      useLabStore.getState().setSimStatus("running");
    } else if (s.architecture === "8051") {
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
      s.setSimStatus("running");
    } else if (s.architecture === "esp32") {
      throw new Error("ESP32 runs in the Wokwi panel below. Paste esp32_sketch.ino into your Wokwi project.");
    } else {
      throw new Error("The Jetson Nano vision tier arrives in Phase 3.");
    }
  } catch (err) {
    publisher?.stop();
    publisher = null;
    useLabStore.getState().setSimStatus("error", err instanceof Error ? err.message : String(err));
  }
}

export function get8051Cpu() {
  return m51?.cpu ?? null; // used by the Phase 4 register visualizer
}