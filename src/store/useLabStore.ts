import { create } from "zustand";
import { MAIN_FILE, TEMPLATES, DEFAULT_LED_PIN, DEFAULT_BUTTON_PIN, PIN_OPTIONS } from "@/sim/templates";
import type { JetsonConfig } from "@/sim/jetson";

export type Role = "guest" | "student" | "instructor" | "admin";
export type Architecture = "8051" | "arduino-uno" | "esp32" | "jetson-nano";
export type ComponentType =
  | "mcu-8051" | "arduino-uno" | "esp32" | "jetson-nano" | "led" | "button" | "oscilloscope";
export type SimStatus = "idle" | "compiling" | "running" | "paused" | "error";
export type ViewMode = "3d" | "2d";

export interface BenchComponent {
  id: string;
  type: ComponentType;
  position: [number, number, number];
  pin?: string;
  color?: string;
  activeLow?: boolean;
}

export interface LabUser { uid: string; email: string | null; displayName: string | null; }

export interface ProjectSnapshot {
  id: string | null;
  name: string;
  architecture: Architecture;
  components: BenchComponent[];
  files: Record<string, string>;
}

export interface JetsonStats { fps: number; inferenceMs: number; detections: number; }
export interface RoomInfo { id: string; isHost: boolean; }
export interface CameraPose { p: [number, number, number]; t: [number, number, number]; }

interface LabState {
  user: LabUser | null;
  role: Role;
  authReady: boolean;

  projectId: string | null;
  projectName: string;
  architecture: Architecture;
  components: BenchComponent[];
  selectedId: string | null;
  files: Record<string, string>;
  activeFile: string;

  simStatus: SimStatus;
  simError: string | null;
  buildMs: number | null;
  serial: string;
  pinStates: Record<string, number>;
  remotePins: Record<string, number>;
  telemetryLatency: number | null;

  autoFlash: boolean;
  scopeOpen: boolean;
  registersOpen: boolean;
  viewMode: ViewMode;
  fallbackReason: string | null;
  online: boolean;
  jetsonConfig: JetsonConfig | null;
  jetsonStats: JetsonStats | null;
  sensorMetrics: Record<string, number>;
  room: RoomInfo | null;
  followHost: boolean;
  remoteCamera: CameraPose | null;

  setAuth: (user: LabUser | null, role: Role) => void;
  setArchitecture: (a: Architecture) => void;
  addComponent: (type: ComponentType) => void;
  updateComponent: (id: string, patch: Partial<BenchComponent>) => void;
  removeComponent: (id: string) => void;
  select: (id: string | null) => void;
  setFile: (name: string, content: string) => void;
  setActiveFile: (name: string) => void;
  setProjectMeta: (id: string | null, name: string) => void;
  setProjectName: (name: string) => void;
  loadSnapshot: (p: ProjectSnapshot) => void;
  newProject: () => void;
  setSimStatus: (s: SimStatus, error?: string | null) => void;
  setBuildMs: (ms: number | null) => void;
  appendSerial: (text: string) => void;
  clearSerial: () => void;
  setPins: (changes: Record<string, number>) => void;
  resetPins: () => void;
  setRemotePins: (pins: Record<string, number>) => void;
  setTelemetryLatency: (ms: number | null) => void;
  setAutoFlash: (v: boolean) => void;
  setScopeOpen: (v: boolean) => void;
  setRegistersOpen: (v: boolean) => void;
  setViewMode: (mode: ViewMode, reason?: string | null) => void;
  setOnline: (v: boolean) => void;
  setJetsonConfig: (c: JetsonConfig | null) => void;
  setJetsonStats: (s: JetsonStats | null) => void;
  setSensorMetrics: (m: Record<string, number>) => void;
  setRoom: (r: RoomInfo | null) => void;
  setFollowHost: (v: boolean) => void;
  setRemoteCamera: (c: CameraPose | null) => void;
  applyRemoteBench: (architecture: Architecture, components: BenchComponent[]) => void;
}

const SERIAL_MAX = 8000;

const initialComponents = (): BenchComponent[] => [
  { id: "scope-1", type: "oscilloscope", position: [-2.2, 0, -0.9] },
  { id: "uno-1", type: "arduino-uno", position: [-0.6, 0, 0.1] },
  { id: "led-1", type: "led", position: [0.4, 0, 0.1], pin: "D13", color: "#ef4444" },
];

function remapPins(components: BenchComponent[], architecture: Architecture): BenchComponent[] {
  const valid = PIN_OPTIONS[architecture];
  return components.map((c) => {
    if (c.type === "led" && (!c.pin || !valid.includes(c.pin))) return { ...c, pin: DEFAULT_LED_PIN[architecture] };
    if (c.type === "button" && (!c.pin || !valid.includes(c.pin))) return { ...c, pin: DEFAULT_BUTTON_PIN[architecture] };
    return c;
  });
}

function withMainFile(files: Record<string, string>, architecture: Architecture) {
  const main = MAIN_FILE[architecture];
  return main in files ? files : { ...files, [main]: TEMPLATES[architecture] };
}

export const useLabStore = create<LabState>((set) => ({
  user: null,
  role: "guest",
  authReady: false,

  projectId: null,
  projectName: "Untitled lab",
  architecture: "arduino-uno",
  components: initialComponents(),
  selectedId: null,
  files: { [MAIN_FILE["arduino-uno"]]: TEMPLATES["arduino-uno"] },
  activeFile: MAIN_FILE["arduino-uno"],

  simStatus: "idle",
  simError: null,
  buildMs: null,
  serial: "",
  pinStates: {},
  remotePins: {},
  telemetryLatency: null,

  autoFlash: true,
  scopeOpen: false,
  registersOpen: false,
  viewMode: "3d",
  fallbackReason: null,
  online: true,
  jetsonConfig: null,
  jetsonStats: null,
  sensorMetrics: {},
  room: null,
  followHost: true,
  remoteCamera: null,

  setAuth: (user, role) => set({ user, role, authReady: true }),

  setArchitecture: (architecture) =>
    set((s) => ({
      architecture,
      files: withMainFile(s.files, architecture),
      activeFile: MAIN_FILE[architecture],
      components: remapPins(s.components, architecture),
      pinStates: {},
    })),

  addComponent: (type) =>
    set((s) => {
      const n = s.components.length;
      const x = -1.2 + (n % 4) * 0.9;
      const z = 0.1 + Math.floor(n / 4) * 0.7;
      const extra =
        type === "led" ? { pin: DEFAULT_LED_PIN[s.architecture], color: "#ef4444" }
        : type === "button" ? { pin: DEFAULT_BUTTON_PIN[s.architecture] }
        : {};
      return {
        components: [
          ...s.components,
          { id: `${type}-${crypto.randomUUID().slice(0, 6)}`, type, position: [x, 0, z], ...extra },
        ],
      };
    }),

  updateComponent: (id, patch) =>
    set((s) => ({ components: s.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

  removeComponent: (id) =>
    set((s) => ({
      components: s.components.filter((c) => c.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  select: (selectedId) => set({ selectedId }),
  setFile: (name, content) => set((s) => ({ files: { ...s.files, [name]: content } })),
  setActiveFile: (activeFile) => set({ activeFile }),
  setProjectMeta: (projectId, projectName) => set({ projectId, projectName }),
  setProjectName: (projectName) => set({ projectName }),

  loadSnapshot: (p) =>
    set({
      projectId: p.id,
      projectName: p.name,
      architecture: p.architecture,
      components: p.components,
      files: withMainFile(p.files, p.architecture),
      activeFile: MAIN_FILE[p.architecture],
      selectedId: null,
      pinStates: {},
      serial: "",
      simStatus: "idle",
      simError: null,
    }),

  newProject: () =>
    set({
      projectId: null,
      projectName: "Untitled lab",
      architecture: "arduino-uno",
      components: initialComponents(),
      files: { [MAIN_FILE["arduino-uno"]]: TEMPLATES["arduino-uno"] },
      activeFile: MAIN_FILE["arduino-uno"],
      selectedId: null,
      pinStates: {},
      serial: "",
      simStatus: "idle",
      simError: null,
    }),

  setSimStatus: (simStatus, simError = null) => set({ simStatus, simError }),
  setBuildMs: (buildMs) => set({ buildMs }),
  appendSerial: (text) => set((s) => ({ serial: (s.serial + text).slice(-SERIAL_MAX) })),
  clearSerial: () => set({ serial: "" }),
  setPins: (changes) => set((s) => ({ pinStates: { ...s.pinStates, ...changes } })),
  resetPins: () => set({ pinStates: {} }),
  setRemotePins: (remotePins) => set({ remotePins }),
  setTelemetryLatency: (telemetryLatency) => set({ telemetryLatency }),
  setAutoFlash: (autoFlash) => set({ autoFlash }),
  setScopeOpen: (scopeOpen) => set({ scopeOpen }),
  setRegistersOpen: (registersOpen) => set({ registersOpen }),
  setViewMode: (viewMode, fallbackReason = null) => set({ viewMode, fallbackReason }),
  setOnline: (online) => set({ online }),
  setJetsonConfig: (jetsonConfig) => set({ jetsonConfig }),
  setJetsonStats: (jetsonStats) => set({ jetsonStats }),
  setSensorMetrics: (sensorMetrics) => set({ sensorMetrics }),
  setRoom: (room) => set({ room }),
  setFollowHost: (followHost) => set({ followHost }),
  setRemoteCamera: (remoteCamera) => set({ remoteCamera }),
  applyRemoteBench: (architecture, components) =>
    set((s) => ({
      architecture,
      components,
      files: withMainFile(s.files, architecture),
      activeFile: MAIN_FILE[architecture],
    })),
}));