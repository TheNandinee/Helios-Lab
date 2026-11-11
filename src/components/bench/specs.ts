import type { Architecture, ComponentType } from "@/store/useLabStore";

export const SPECS: Record<ComponentType, { size: [number, number, number]; color: string; label: string }> = {
  "mcu-8051":    { size: [0.9, 0.08, 0.3],   color: "#1f2937", label: "8051 (AT89S52)" },
  "arduino-uno": { size: [0.69, 0.05, 0.53], color: "#0e7490", label: "Arduino Uno" },
  esp32:         { size: [0.52, 0.04, 0.28], color: "#111827", label: "ESP32 DevKit" },
  "jetson-nano": { size: [1.0, 0.3, 0.8],    color: "#4d7c0f", label: "Jetson Nano" },
  led:           { size: [0.08, 0.14, 0.08], color: "#ef4444", label: "LED" },
  button:        { size: [0.14, 0.06, 0.14], color: "#64748b", label: "Push button" },
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