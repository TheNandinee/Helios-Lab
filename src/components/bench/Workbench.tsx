"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, PerformanceMonitor, Html, useGLTF, Detailed } from "@react-three/drei";
import type { Vector3 } from "three";
import { useLabStore, type BenchComponent } from "@/store/useLabStore";
import { SPECS, BOARD_ARCH } from "@/components/bench/specs";
import { setButtonInput } from "@/sim/controller";
import { setRenderer } from "@/components/bench/glControl";
import { publishCamera } from "@/lib/rooms";

function BenchItem({ item }: { item: BenchComponent }) {
  const spec = SPECS[item.type];
  const selected = useLabStore((s) => s.selectedId === item.id);
  const isActiveBoard = useLabStore((s) => BOARD_ARCH[item.type] === s.architecture);
  const pinValue = useLabStore((s) => (item.pin ? s.pinStates[item.pin] : undefined));
  const select = useLabStore((s) => s.select);
  const [hovered, setHovered] = useState(false);
  const holding = useRef(false);

  // 1. Load the 3D model based on the item type
   const modelName = item.type === "mcu-8051" ? "8051" : item.type;
  const { scene } = useGLTF(`/models/${modelName}.glb`);

  const isLed = item.type === "led";
  const isButton = item.type === "button";
  const ledColor = item.color ?? spec.color;
  const ledOn = isLed && pinValue !== undefined && (item.activeLow ? pinValue === 0 : pinValue === 1);
  const pressed = isButton && pinValue === 0;

  const emissive = ledOn ? ledColor : selected ? "#38bdf8" : hovered ? "#0ea5e9" : isActiveBoard ? "#1e40af" : "#000000";
  const emissiveIntensity = ledOn ? 2.5 : selected ? 0.6 : hovered ? 0.3 : isActiveBoard ? 0.25 : 0;
  const height = pressed ? spec.size[1] * 0.5 : spec.size[1];

  const release = () => {
    if (holding.current && item.pin) setButtonInput(item.pin, false);
    holding.current = false;
  };

  return (
    <group
      position={[item.position[0], height / 2, item.position[2]]}
      scale={[1, pressed ? 0.5 : 1, 1]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(item.id); }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (!isButton || !item.pin) return;
        e.stopPropagation();
        holding.current = true;
        setButtonInput(item.pin, true);
      }}
      onPointerUp={release}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
        release();
      }}
    >
      {/* 2. Render model with Level of Detail (LOD) */}
      <Detailed distances={[0, 8, 15]}>
        {/* High Poly: Asli Model */}
        <group scale={[spec.size[0], spec.size[1], spec.size[2]]}>
          <primitive object={scene.clone()}>
            <meshStandardMaterial 
              color={isLed ? ledColor : spec.color} 
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </primitive>
        </group>
        
        {/* Medium Poly: Thoda simple box (taaki GPU bache) */}
        <group scale={[spec.size[0], spec.size[1], spec.size[2]]}>
          <mesh>
            <boxGeometry />
            <meshStandardMaterial color={spec.color} transparent opacity={0.8} />
          </mesh>
        </group>

        {/* Low Poly: Simple Box for distance */}
        <mesh scale={[spec.size[0], spec.size[1], spec.size[2]]}>
          <boxGeometry />
          <meshStandardMaterial color="#333" />
        </mesh>
      </Detailed>

      
      {/* LED Glow - Updated for Phase 2 */}
      {isLed && <pointLight color={ledColor} intensity={ledOn ? 3.5 : 0} distance={2.5} position={[0, 0.15, 0]} />}
      {/* Keep the hover label */}
      {(hovered || selected) && (
        <Html position={[0, spec.size[1] / 2 + 0.15, 0]} center className="pointer-events-none">
          <div className="whitespace-nowrap rounded bg-slate-900/90 px-2 py-1 text-xs text-sky-300">
            {spec.label}{item.pin ? ` · ${item.pin}` : ""}{pressed ? " · pressed" : ""}
          </div>
        </Html>
      )}
    </group>
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
    if (elapsed > 2000 || document.visibilityState !== "visible") { lowStreak.current = 0; return; } // tab was hidden
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

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [0, 3.2, 4.5], fov: 45 }}
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
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 3]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-3, 3, -2]} intensity={15} color="#60a5fa" />

      <Table />
      {/* 3. Wrap models in Suspense so they load without crashing */}
      <Suspense fallback={null}>
        {components.map((c) => <BenchItem key={c.id} item={c} />)}
      </Suspense>
      
      <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={8} blur={2} />

      <OrbitControls makeDefault target={[0, 0.3, 0]} minDistance={2} maxDistance={9} maxPolarAngle={Math.PI / 2.15} />
      <CameraSync />
    </Canvas>
  );
}