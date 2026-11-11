export interface JetsonConfig {
  model: string;
  classes: string[];
  threshold: number;
  fps: number;
  showLabels: boolean;
}

export const KNOWN_CLASSES = ["person", "car", "bicycle", "dog", "truck"] as const;

const MODEL_LATENCY_MS: Record<string, number> = {
  "ssd-mobilenet-v2": 22,
  "ssd-inception-v2": 41,
  yolov5s: 34,
  peoplenet: 28,
};

export function modelLatency(model: string) {
  return MODEL_LATENCY_MS[model] ?? 30;
}

function setting(src: string, name: string): string | null {
  const m = new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*(#.*)?$`, "m").exec(src);
  return m ? m[1] : null;
}

export function parseJetsonConfig(src: string): JetsonConfig {
  const errors: string[] = [];
  const unquote = (s: string) => s.replace(/^["']|["']$/g, "");

  const model = unquote(setting(src, "MODEL") ?? "ssd-mobilenet-v2");
  if (!(model in MODEL_LATENCY_MS)) errors.push(`MODEL must be one of: ${Object.keys(MODEL_LATENCY_MS).join(", ")}`);

  const rawClasses = setting(src, "CLASSES");
  const classes = rawClasses
    ? Array.from(rawClasses.matchAll(/["']([^"']+)["']/g), (m) => m[1].toLowerCase())
    : ["person", "car"];
  const unknown = classes.filter((c) => !(KNOWN_CLASSES as readonly string[]).includes(c));
  if (unknown.length) errors.push(`Unknown class(es): ${unknown.join(", ")}. Available: ${KNOWN_CLASSES.join(", ")}`);

  const threshold = Number(setting(src, "CONFIDENCE_THRESHOLD") ?? 0.5);
  if (!(threshold >= 0 && threshold <= 1)) errors.push("CONFIDENCE_THRESHOLD must be between 0 and 1");

  const fps = Number(setting(src, "CAMERA_FPS") ?? 30);
  if (!(fps >= 1 && fps <= 60)) errors.push("CAMERA_FPS must be between 1 and 60");

  const showLabels = (setting(src, "SHOW_LABELS") ?? "True").startsWith("True");

  if (errors.length) throw new Error(errors.join("\n"));
  return { model, classes, threshold, fps, showLabels };
}