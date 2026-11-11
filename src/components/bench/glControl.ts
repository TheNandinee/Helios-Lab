import type { WebGLRenderer } from "three";

let renderer: WebGLRenderer | null = null;

export function setRenderer(r: WebGLRenderer | null) {
  renderer = r;
}

/** Demo / test helper: forces a real WebGL context loss */
export function simulateContextLoss(): boolean {
  const ext = renderer?.getContext().getExtension("WEBGL_lose_context");
  if (!ext) return false;
  ext.loseContext();
  return true;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}