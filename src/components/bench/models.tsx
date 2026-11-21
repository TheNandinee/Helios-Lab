"use client";

import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF, Line } from "@react-three/drei";
import { Box3, Vector3, type Mesh, type Object3D } from "three";
import type { ComponentType } from "@/store/useLabStore";
import { SPECS } from "@/components/bench/specs";

type V3 = [number, number, number];

/**
 * Optional GLB models from Person 2. Leave empty to use the built-in models.
 * Any model listed here is auto-scaled to the footprint in specs.ts, centred,
 * and placed on the table. If it fails to load, the built-in model is used.
 * Example:  "arduino-uno": "/models/arduino-uno.glb",
 */
export const GLB_MODELS: Partial<Record<ComponentType, string>> = {};

const SILVER = "#cbd5e1";
const HEADER = "#0f172a";

function Box({ p, s, c, metal = 0, rough = 0.7 }: { p: V3; s: V3; c: string; metal?: number; rough?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} metalness={metal} roughness={rough} />
    </mesh>
  );
}

function Cyl({ p, r, h, c, rot = [0, 0, 0], metal = 0, rough = 0.6 }: {
  p: V3; r: number; h: number; c: string; rot?: V3; metal?: number; rough?: number;
}) {
  return (
    <mesh position={p} rotation={rot} castShadow>
      <cylinderGeometry args={[r, r, h, 24]} />
      <meshStandardMaterial color={c} metalness={metal} roughness={rough} />
    </mesh>
  );
}

function ArduinoUno() {
  return (
    <group>
      <Box p={[0, 0.014, 0]} s={[0.69, 0.016, 0.53]} c="#0e7490" />
      <Box p={[-0.26, 0.062, -0.14]} s={[0.17, 0.08, 0.13]} c={SILVER} metal={0.9} rough={0.3} />
      <Box p={[-0.28, 0.055, 0.17]} s={[0.13, 0.065, 0.1]} c="#111827" />
      <Box p={[0.12, 0.026, 0.13]} s={[0.34, 0.008, 0.11]} c="#94a3b8" metal={0.8} />
      <Box p={[0.12, 0.038, 0.13]} s={[0.32, 0.026, 0.085]} c="#111827" />
      <Box p={[0.06, 0.045, -0.235]} s={[0.52, 0.045, 0.035]} c={HEADER} />
      <Box p={[0.1, 0.045, 0.235]} s={[0.44, 0.045, 0.035]} c={HEADER} />
      <Box p={[-0.08, 0.032, 0]} s={[0.05, 0.02, 0.025]} c={SILVER} metal={0.9} />
      <Cyl p={[-0.17, 0.034, -0.02]} r={0.022} h={0.02} c="#ef4444" />
    </group>
  );
}

function Esp32() {
  return (
    <group>
      <Box p={[0, 0.012, 0]} s={[0.52, 0.014, 0.28]} c="#111827" />
      <Box p={[0.08, 0.03, 0]} s={[0.22, 0.022, 0.16]} c={SILVER} metal={0.9} rough={0.3} />
      <Box p={[0.215, 0.021, 0]} s={[0.07, 0.004, 0.16]} c="#1e3a8a" />
      <Box p={[-0.03, 0.032, 0.12]} s={[0.44, 0.026, 0.024]} c={HEADER} />
      <Box p={[-0.03, 0.032, -0.12]} s={[0.44, 0.026, 0.024]} c={HEADER} />
      <Box p={[-0.235, 0.03, 0]} s={[0.05, 0.022, 0.08]} c={SILVER} metal={0.9} />
      <Box p={[-0.15, 0.026, 0.05]} s={[0.03, 0.012, 0.03]} c="#f8fafc" />
    </group>
  );
}

function Mcu8051() {
  return (
    <group>
      <Box p={[0, 0.012, 0]} s={[0.9, 0.014, 0.3]} c="#166534" />
      <Box p={[0, 0.024, 0.075]} s={[0.58, 0.012, 0.02]} c={SILVER} metal={0.9} />
      <Box p={[0, 0.024, -0.075]} s={[0.58, 0.012, 0.02]} c={SILVER} metal={0.9} />
      <Box p={[0, 0.04, 0]} s={[0.6, 0.034, 0.13]} c="#111827" />
      <Cyl p={[-0.27, 0.058, 0]} r={0.014} h={0.004} c="#374151" />
      <Box p={[0.37, 0.035, -0.07]} s={[0.07, 0.03, 0.04]} c={SILVER} metal={0.9} />
      <Cyl p={[0.37, 0.035, 0.07]} r={0.02} h={0.03} c="#1d4ed8" />
    </group>
  );
}

function JetsonNano() {
  return (
    <group>
      <Box p={[0, 0.012, 0]} s={[1.0, 0.016, 0.8]} c="#14532d" />
      <Box p={[0, 0.04, -0.05]} s={[0.66, 0.04, 0.6]} c="#1f2937" />
      <Box p={[0, 0.075, -0.05]} s={[0.6, 0.03, 0.55]} c="#111111" metal={0.6} />
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} p={[-0.28 + i * 0.07, 0.17, -0.05]} s={[0.018, 0.16, 0.55]} c="#18181b" metal={0.6} rough={0.4} />
      ))}
      <Box p={[-0.3, 0.06, 0.33]} s={[0.14, 0.09, 0.1]} c={SILVER} metal={0.9} rough={0.3} />
      <Box p={[0.05, 0.07, 0.33]} s={[0.16, 0.11, 0.12]} c={SILVER} metal={0.9} rough={0.3} />
      <Box p={[0.3, 0.04, 0.35]} s={[0.12, 0.05, 0.08]} c="#111827" />
    </group>
  );
}

function Oscilloscope() {
  const trace = useMemo(
    () => Array.from({ length: 60 }, (_, i) => {
      const x = -0.48 + (i / 59) * 0.6;
      return [x, 0.52 + 0.1 * Math.sin(i * 0.42), 0.309] as V3;
    }),
    []
  );
  return (
    <group>
      {[[-0.5, -0.22], [0.5, -0.22], [-0.5, 0.22], [0.5, 0.22]].map(([x, z], i) => (
        <Box key={i} p={[x, 0.015, z]} s={[0.1, 0.03, 0.08]} c="#111827" />
      ))}
      <Box p={[0, 0.45, 0]} s={[1.2, 0.84, 0.6]} c="#374151" />
      <Box p={[0, 0.45, 0.302]} s={[1.16, 0.8, 0.006]} c="#1f2937" />
      <mesh position={[-0.18, 0.52, 0.307]}>
        <planeGeometry args={[0.66, 0.46]} />
        <meshStandardMaterial color="#022c22" emissive="#064e3b" emissiveIntensity={0.8} />
      </mesh>
      <Line points={trace} color="#facc15" lineWidth={2} />
      {Array.from({ length: 6 }, (_, k) => (
        <Cyl key={k} p={[0.3 + (k % 2) * 0.13, 0.66 - Math.floor(k / 2) * 0.14, 0.32]} r={0.035} h={0.04}
          c="#9ca3af" rot={[Math.PI / 2, 0, 0]} metal={0.4} />
      ))}
      {Array.from({ length: 5 }, (_, k) => (
        <Box key={k} p={[-0.45 + k * 0.12, 0.22, 0.31]} s={[0.08, 0.035, 0.02]} c="#64748b" />
      ))}
      <Cyl p={[-0.35, 0.12, 0.32]} r={0.025} h={0.04} c={SILVER} rot={[Math.PI / 2, 0, 0]} metal={0.9} />
      <Cyl p={[-0.15, 0.12, 0.32]} r={0.025} h={0.04} c={SILVER} rot={[Math.PI / 2, 0, 0]} metal={0.9} />
    </group>
  );
}

function Led({ color, on }: { color: string; on: boolean }) {
  return (
    <group>
      <Cyl p={[-0.018, 0.03, 0]} r={0.004} h={0.06} c={SILVER} metal={1} rough={0.3} />
      <Cyl p={[0.018, 0.03, 0]} r={0.004} h={0.06} c={SILVER} metal={1} rough={0.3} />
      {/* flange + body + dome */}
      <mesh position={[0, 0.066, 0]} castShadow>
        <cylinderGeometry args={[0.052, 0.052, 0.012, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={on ? 2 : 0.05}
          transparent opacity={on ? 0.95 : 0.6} roughness={0.2} toneMapped={!on} />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.06, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={on ? 3 : 0.05}
          transparent opacity={on ? 0.95 : 0.6} roughness={0.15} toneMapped={!on} />
      </mesh>
      <mesh position={[0, 0.13, 0]} castShadow>
        <sphereGeometry args={[0.045, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={on ? 3 : 0.05}
          transparent opacity={on ? 0.95 : 0.6} roughness={0.15} toneMapped={!on} />
      </mesh>
      {on && (
        <mesh position={[0, 0.11, 0]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <pointLight color={color} intensity={on ? 1.8 : 0} distance={1.2} position={[0, 0.15, 0]} />
    </group>
  );
}

function PushButton({ color, pressed }: { color: string; pressed: boolean }) {
  return (
    <group>
      {[[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]].map(([x, z], i) => (
        <Box key={i} p={[x, 0.006, z]} s={[0.015, 0.012, 0.015]} c={SILVER} metal={0.9} />
      ))}
      <Box p={[0, 0.022, 0]} s={[0.14, 0.036, 0.14]} c="#1f2937" />
      <Box p={[0, 0.042, 0]} s={[0.13, 0.004, 0.13]} c={SILVER} metal={0.9} rough={0.3} />
      <Cyl p={[0, pressed ? 0.05 : 0.062, 0]} r={0.04} h={0.03} c={color} />
    </group>
  );
}

export function ProceduralModel({ type, color, on, pressed }: {
  type: ComponentType; color: string; on: boolean; pressed: boolean;
}) {
  switch (type) {
    case "arduino-uno": return <ArduinoUno />;
    case "esp32": return <Esp32 />;
    case "mcu-8051": return <Mcu8051 />;
    case "jetson-nano": return <JetsonNano />;
    case "oscilloscope": return <Oscilloscope />;
    case "led": return <Led color={color} on={on} />;
    case "button": return <PushButton color={color} pressed={pressed} />;
  }
}

// ---- optional GLB support, auto-normalised so it can never float off the table ----

function normalise(src: Object3D, size: V3): Object3D {
  const obj = src.clone(true);
  obj.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  obj.position.set(0, 0, 0);
  obj.scale.set(1, 1, 1);
  obj.updateMatrixWorld(true);

  const box = new Box3().setFromObject(obj);
  const dim = box.getSize(new Vector3());
  const fit = Math.min(
    dim.x > 1e-6 ? size[0] / dim.x : Infinity,
    dim.z > 1e-6 ? size[2] / dim.z : Infinity,
    dim.y > 1e-6 ? (size[1] * 3) / dim.y : Infinity
  );
  obj.scale.setScalar(Number.isFinite(fit) ? fit : 1);
  obj.updateMatrixWorld(true);

  box.setFromObject(obj);
  const c = box.getCenter(new Vector3());
  obj.position.set(-c.x, -box.min.y, -c.z); // centred, bottom on the table
  return obj;
}

function GlbModel({ url, type }: { url: string; type: ComponentType }) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => normalise(scene, SPECS[type].size), [scene, type]);
  return <primitive object={object} />;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { console.warn("GLB failed, using built-in model:", e.message); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function ComponentModel(props: { type: ComponentType; color: string; on: boolean; pressed: boolean }) {
  const procedural = <ProceduralModel {...props} />;
  const url = GLB_MODELS[props.type];
  // LEDs and buttons always use the built-in model so glow/press keep working
  if (!url || props.type === "led" || props.type === "button") return procedural;
  return (
    <ModelBoundary fallback={procedural}>
      <Suspense fallback={procedural}>
        <GlbModel url={url} type={props.type} />
      </Suspense>
    </ModelBoundary>
  );
}