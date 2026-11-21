"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, PerformanceMonitor, Html } from "@react-three/drei";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { useLabStore, type BenchComponent, type ComponentType } from "@/store/useLabStore";
import { SPECS, BOARD_ARCH, clampToTable } from "@/components/bench/specs";
import { ComponentModel } from "@/components/bench/models";
import { setButtonInput } from "@/sim/controller";
import { setRenderer } from "@/components/bench/glControl";
import { publishCamera } from "@/lib/rooms";

// ---------- drag state (module level, shared by items and the controller) ----------
interface DragState {
  id: string; type: ComponentType;
  startX: number; startY: number; startPos: [number, number];
  offset: [number, number] | null; active: boolean; onActivate?: () => void;
}
let drag: DragState | null = null;
let hoverId: string | null = null;
let orbit: { enabled: boolean } | null = null;

const syncOrbit = () => { if (orbit) orbit.enabled = drag === null && hoverId === null; };
const canEdit = () => {
  const s = useLabStore.getState();
  return !(s.room && !s.room.isHost && s.followHost);
};

function BenchItem({ item }: { item: BenchComponent }) {
  const spec = SPECS[item.type];
  const selected = useLabStore((s) => s.selectedId === item.id);
  const isActiveBoard = useLabStore((s) => BOARD_ARCH[item.type] === s.architecture);
  const pinValue = useLabStore((s) => (item.pin ? s.pinStates[item.pin] : undefined));
  const select = useLabStore((s) => s.select);
  const [hovered, setHovered] = useState(false);
  const holding = useRef(false);

  const isLed = item.type === "led";
  const isButton = item.type === "button";
  const color = item.color ?? spec.color;
  const ledOn = isLed && pinValue !== undefined && (item.activeLow ? pinValue === 0 : pinValue === 1);
  const pressed = isButton && pinValue === 0;
  const [x, z] = clampToTable(item.type, item.position?.[0], item.position?.[2]);

  const release = () => {
    if (holding.current && item.pin) setButtonInput(item.pin, false);
    holding.current = false;
  };

  const plateOpacity = selected ? 0.45 : hovered ? 0.25 : isActiveBoard ? 0.18 : 0;

  return (
    <group
      position={[x, 0, z]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(item.id); }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (e.nativeEvent.button !== 0) return;
        e.stopPropagation();
        if (isButton && item.pin) { holding.current = true; setButtonInput(item.pin, true); }
        if (canEdit()) {
          drag = {
            id: item.id, type: item.type,
            startX: e.nativeEvent.clientX, startY: e.nativeEvent.clientY,
            startPos: [x, z], offset: null, active: false,
            onActivate: isButton ? release : undefined,
          };
          syncOrbit();
        }
      }}
      onPointerUp={release}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        hoverId = item.id;
        syncOrbit();
        if (!drag?.active) document.body.style.cursor = canEdit() ? "grab" : "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        if (hoverId === item.id) hoverId = null;
        syncOrbit();
        if (!drag?.active) { document.body.style.cursor = "auto"; release(); }
      }}
    >
      {/* selection / active-board plate on the table */}
      {plateOpacity > 0 && (
        <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[spec.size[0] + 0.1, spec.size[2] + 0.1]} />
          <meshBasicMaterial color={selected || hovered ? "#38bdf8" : "#1d4ed8"} transparent opacity={plateOpacity} depthWrite={false} />
        </mesh>
      )}

      <ComponentModel type={item.type} color={color} on={ledOn} pressed={pressed} />

      {(hovered || selected) && (
        <Html position={[0, spec.size[1] + 0.15, 0]} center className="pointer-events-none">
          <div className="whitespace-nowrap rounded bg-slate-900/90 px-2 py-1 text-xs text-sky-300">
            {spec.label}{item.pin ? ` · ${item.pin}` : ""}{pressed ? " · pressed" : ""}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Moves the dragged component across the table plane (y = 0) */
function DragController() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;

  useEffect(() => {
    orbit = controls;
    syncOrbit();
    return () => { orbit = null; };
  }, [controls]);

  useEffect(() => {
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const plane = new Plane(new Vector3(0, 1, 0), 0);
    const hit = new Vector3();

    const planeAt = (cx: number, cy: number): [number, number] | null => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(plane, hit) ? [hit.x, hit.z] : null;
    };

    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return; // click, not drag
        const p0 = planeAt(drag.startX, drag.startY);
        if (!p0) return;
        drag.offset = [drag.startPos[0] - p0[0], drag.startPos[1] - p0[1]];
        drag.active = true;
        drag.onActivate?.();
        document.body.style.cursor = "grabbing";
      }
      const p = planeAt(e.clientX, e.clientY);
      if (!p || !drag.offset) return;
      const [x, z] = clampToTable(drag.type, p[0] + drag.offset[0], p[1] + drag.offset[1]);
      useLabStore.getState().updateComponent(drag.id, { position: [x, 0, z] });
    };

    const onUp = () => {
      if (!drag) return;
      const wasActive = drag.active;
      drag = null;
      syncOrbit();
      if (wasActive) document.body.style.cursor = hoverId ? "grab" : "auto";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [camera, gl]);

  return null;
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
        <mesh key={i} position={[x, -0.8, z]} castShadow>
          <boxGeometry args={[0.12, 1.5, 0.12]} />
          <meshStandardMaterial color="#27272a" />
        </mesh>
      ))}
    </group>
  );
}

/** SRE: if FPS stays below 15 for 3 consecutive seconds, switch to the 2D schematic */
function FpsWatchdog() {
  const frames = useRef(0);
  const windowStart = useRef(0);
  const lowStreak = useRef(0);
  const warmup = useRef(3);

  useFrame(() => {
    const now = performance.now();
    if (windowStart.current === 0) { windowStart.current = now; return; }
    frames.current++;
    const elapsed = now - windowStart.current;
    if (elapsed < 1000) return;
    const fps = (frames.current * 1000) / elapsed;
    frames.current = 0;
    windowStart.current = now;
    if (elapsed > 2000 || document.visibilityState !== "visible") { lowStreak.current = 0; return; }
    if (warmup.current > 0) { warmup.current--; return; }
    lowStreak.current = fps < 15 ? lowStreak.current + 1 : 0;
    if (lowStreak.current >= 3) {
      useLabStore.getState().setViewMode("2d", `Low frame rate (${Math.round(fps)} FPS)`);
    }
  });
  return null;
}

/** Instructor camera broadcast for collaborative rooms */
function CameraSync() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const room = useLabStore((s) => s.room);
  const followHost = useLabStore((s) => s.followHost);
  const remoteCamera = useLabStore((s) => s.remoteCamera);
  const lastSent = useRef("");

  useEffect(() => {
    if (!room?.isHost || !controls) return;
    const id = setInterval(() => {
      const p = camera.position, t = controls.target;
      const pose = {
        p: [p.x, p.y, p.z].map((n) => Number(n.toFixed(3))) as [number, number, number],
        t: [t.x, t.y, t.z].map((n) => Number(n.toFixed(3))) as [number, number, number],
      };
      const key = JSON.stringify(pose);
      if (key === lastSent.current) return;
      lastSent.current = key;
      publishCamera(room.id, pose);
    }, 250);
    return () => clearInterval(id);
  }, [room, camera, controls]);

  useEffect(() => {
    if (!room || room.isHost || !followHost || !remoteCamera || !controls) return;
    camera.position.set(...remoteCamera.p);
    controls.target.set(...remoteCamera.t);
    controls.update();
  }, [room, followHost, remoteCamera, camera, controls]);

  return null;
}

export default function Workbench() {
  const components = useLabStore((s) => s.components);
  const select = useLabStore((s) => s.select);
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => () => setRenderer(null), []);

  // Repair any stored positions that are off the table (old drafts, saved projects, bad placement)
  useEffect(() => {
    if (!canEdit()) return;
    const st = useLabStore.getState();
    for (const c of components) {
      const [x, z] = clampToTable(c.type, c.position?.[0], c.position?.[2]);
      if (x !== c.position?.[0] || z !== c.position?.[2] || c.position?.[1] !== 0) {
        st.updateComponent(c.id, { position: [x, 0, z] });
      }
    }
  }, [components]);

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [0, 3.4, 4.6], fov: 45 }}
      onPointerMissed={() => select(null)}
      onCreated={({ gl }) => {
        setRenderer(gl);
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          useLabStore.getState().setViewMode("2d", "WebGL context lost");
        });
      }}
    >
      <PerformanceMonitor onIncline={() => setDpr(2)} onDecline={() => setDpr(1)} />
      <FpsWatchdog />
      <color attach="background" args={["#0b1020"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-3, 3, -2]} intensity={15} color="#60a5fa" />

      <Table />
      {components.map((c) => <BenchItem key={c.id} item={c} />)}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={8} blur={2} />

      <OrbitControls makeDefault target={[0, 0.3, 0]} minDistance={2} maxDistance={9} maxPolarAngle={Math.PI / 2.15} />
      <DragController />
      <CameraSync />
    </Canvas>
  );
}