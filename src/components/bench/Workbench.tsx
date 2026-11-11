"use client";

import { useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, PerformanceMonitor, Html } from "@react-three/drei";
import { useLabStore, type BenchComponent, type ComponentType } from "@/store/useLabStore";

export const SPECS: Record<ComponentType, { size: [number, number, number]; color: string; label: string }> = {
  "mcu-8051":    { size: [0.9, 0.08, 0.3],  color: "#1f2937", label: "8051 (AT89S52)" },
  "arduino-uno": { size: [0.69, 0.05, 0.53], color: "#0e7490", label: "Arduino Uno" },
  esp32:         { size: [0.52, 0.04, 0.28], color: "#111827", label: "ESP32 DevKit" },
  "jetson-nano": { size: [1.0, 0.3, 0.8],   color: "#4d7c0f", label: "Jetson Nano" },
  led:           { size: [0.08, 0.14, 0.08], color: "#ef4444", label: "LED" },
  oscilloscope:  { size: [1.2, 0.9, 0.6],   color: "#374151", label: "Oscilloscope" },
};

function BenchItem({ item }: { item: BenchComponent }) {
  const spec = SPECS[item.type];
  const selectedId = useLabStore((s) => s.selectedId);
  const select = useLabStore((s) => s.select);
  const [hovered, setHovered] = useState(false);
  const selected = selectedId === item.id;

  return (
    <mesh
      position={[item.position[0], spec.size[1] / 2, item.position[2]]}
      castShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        select(item.id);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <boxGeometry args={spec.size} />
      <meshStandardMaterial
        color={spec.color}
        emissive={selected ? "#38bdf8" : hovered ? "#0ea5e9" : "#000000"}
        emissiveIntensity={selected ? 0.6 : hovered ? 0.3 : 0}
      />
      {(hovered || selected) && (
        <Html position={[0, spec.size[1] / 2 + 0.15, 0]} center className="pointer-events-none">
          <div className="whitespace-nowrap rounded bg-slate-900/90 px-2 py-1 text-xs text-sky-300">
            {spec.label}
          </div>
        </Html>
      )}
    </mesh>
  );
}

function Table() {
  const legs: [number, number][] = [[-2.8, -1.3], [2.8, -1.3], [-2.8, 1.3], [2.8, 1.3]];
  return (
    <group>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[6, 0.1, 3]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.8} />
      </mesh>
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.8, z]}>
          <boxGeometry args={[0.12, 1.5, 0.12]} />
          <meshStandardMaterial color="#27272a" />
        </mesh>
      ))}
    </group>
  );
}

export default function Workbench() {
  const components = useLabStore((s) => s.components);
  const select = useLabStore((s) => s.select);
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [0, 3.2, 4.5], fov: 45 }}
      onPointerMissed={() => select(null)}
    >
      <PerformanceMonitor onIncline={() => setDpr(2)} onDecline={() => setDpr(1)} />
      <color attach="background" args={["#0b1020"]} />

      {/* Lighting rig */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 3]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-3, 3, -2]} intensity={15} color="#60a5fa" />

      <Table />
      {components.map((c) => (
        <BenchItem key={c.id} item={c} />
      ))}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={8} blur={2} />

      {/* Camera bounds: can't go under the table or fly away */}
      <OrbitControls
        makeDefault
        target={[0, 0.3, 0]}
        minDistance={2}
        maxDistance={9}
        maxPolarAngle={Math.PI / 2.15}
      />
    </Canvas>
  );
}