import type { Architecture, ComponentType } from "@/store/useLabStore";

export const SPECS: Record<ComponentType, { size: [number, number, number]; color: string; label: string }> = {
  "mcu-8051":    { size: [0.9, 0.08, 0.3],   color: "#166534", label: "8051 (AT89S52)" },
  "arduino-uno": { size: [0.69, 0.08, 0.53], color: "#0e7490", label: "Arduino Uno" },
  esp32:         { size: [0.52, 0.05, 0.28], color: "#111827", label: "ESP32 DevKit" },
  "jetson-nano": { size: [1.0, 0.3, 0.8],    color: "#14532d", label: "Jetson Nano" },
  led:           { size: [0.12, 0.2, 0.12],  color: "#ef4444", label: "LED" },
  button:        { size: [0.16, 0.08, 0.16], color: "#ef4444", label: "Push button" },
  oscilloscope:  { size: [1.2, 0.9, 0.6],    color: "#374151", label: "Oscilloscope" },
};

export const BOARD_ARCH: Partial<Record<ComponentType, Architecture>> = {
  "mcu-8051": "8051",
  "arduino-uno": "arduino-uno",
  esp32: "esp32",
  "jetson-nano": "jetson-nano",
};

export const BOARD_NOTES: Partial<Record<ComponentType, string>> = {
  "mcu-8051": "Ports P0–P3 (32 I/O) · 12 MHz · Timer 0/1 + interrupts · 8051 Assembly",
  "arduino-uno": "D0–D13, A0–A5 · 16 MHz ATmega328P · 10-bit ADC (5 V)",
  esp32: "Dual-core Xtensa · runs in Wokwi · streams to Firebase over Wi-Fi · 12-bit ADC (3.3 V)",
  "jetson-nano": "Edge AI tier · simulated TensorRT detection on a synthetic CSI camera stream",
};

// Table top is 6 x 3 units, centred on the origin, surface at y = 0
export const TABLE = { halfX: 3, halfZ: 1.5, margin: 0.05 };

/** Keeps a component fully on the table (also repairs NaN/undefined positions) */
export function clampToTable(type: ComponentType, x: number | undefined, z: number | undefined): [number, number] {
  const [w, , d] = SPECS[type].size;
  const mx = TABLE.halfX - w / 2 - TABLE.margin;
  const mz = TABLE.halfZ - d / 2 - TABLE.margin;
  const fx = Number.isFinite(x) ? (x as number) : 0;
  const fz = Number.isFinite(z) ? (z as number) : 0;
  return [Math.max(-mx, Math.min(mx, fx)), Math.max(-mz, Math.min(mz, fz))];
}