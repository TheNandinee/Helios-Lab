import { create } from "zustand";
import { MAIN_FILE, TEMPLATES, DEFAULT_LED_PIN, PIN_OPTIONS } from "@/sim/templates";

export type Role = "guest" | "student" | "instructor" | "admin";
export type Architecture = "8051" | "arduino-uno" | "esp32" | "jetson-nano";
export type ComponentType =
  | "mcu-8051" | "arduino-uno" | "esp32" | "jetson-nano" | "led" | "oscilloscope";
export type SimStatus = "idle" | "compiling" | "running" | "error";

export interface BenchComponent {
  id: string;
  type: ComponentType;
  position: [number, number, number];
  pin?: string;
  color?: string;
  activeLow?: boolean;
}

export interface LabUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface ProjectSnapshot {
  id: string;
  name: string;
  architecture: Architecture;
  components: BenchComponent[];
  files: Record<string, string>;
}

interface LabState {
  // auth
  user: LabUser | null;
  role: Role;
  authReady: boolean;
  // project
  projectId: string | null;
  projectName: string;
  architecture: Architecture;
  components: BenchComponent[];
  selectedId: string | null;
  files: Record<string, string>;
  activeFile: string;
  // simulation + telemetry
  simStatus: SimStatus;
  simError: string | null;
  buildMs: number | null;
  serial: string;
  pinStates: Record<string, number>;
  remotePins: Record<string, number>;
  telemetryLatency: number | null;

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
}

const SERIAL_MAX = 8000;

const initialComponents = (): BenchComponent[] => [
  { id: "scope-1", type: "oscilloscope", position: [-2.2, 0, -0.9] },
  { id: "uno-1", type: "arduino-uno", position: [-0.6, 0, 0.1] },
  { id: "led-1", type: "led", position: [0.4, 0, 0.1], pin: "D13", color: "#ef4444" },
];

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

  setAuth: (user, role) => set({ user, role, authReady: true }),

  setArchitecture: (architecture) =>
    set((s) => {
      const main = MAIN_FILE[architecture];
      const files = main in s.files ? s.files : { ...s.files, [main]: TEMPLATES[architecture] };
      const valid = PIN_OPTIONS[architecture];
      const components = s.components.map((c) =>
        c.type === "led" && (!c.pin || !valid.includes(c.pin))
          ? { ...c, pin: DEFAULT_LED_PIN[architecture] }
          : c
      );
      return { architecture, files, activeFile: main, components, pinStates: {} };
    }),

  addComponent: (type) =>
    set((s) => {
      const n = s.components.length;
      const x = -1.2 + (n % 4) * 0.9;
      const z = 0.1 + Math.floor(n / 4) * 0.7;
      const extra = type === "led" ? { pin: DEFAULT_LED_PIN[s.architecture], color: "#ef4444" } : {};
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
      files: p.files,
      activeFile: MAIN_FILE[p.architecture] in p.files
        ? MAIN_FILE[p.architecture]
        : Object.keys(p.files)[0] ?? MAIN_FILE[p.architecture],
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
}));