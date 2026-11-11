import { create } from "zustand";

export type Role = "guest" | "student" | "instructor" | "admin";
export type Architecture = "8051" | "arduino-uno" | "esp32" | "jetson-nano";
export type ComponentType =
  | "mcu-8051" | "arduino-uno" | "esp32" | "jetson-nano" | "led" | "oscilloscope";

export interface BenchComponent {
  id: string;
  type: ComponentType;
  position: [number, number, number]; // x, (unused y), z on the table
}

export interface LabUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface LabState {
  user: LabUser | null;
  role: Role;
  authReady: boolean;
  architecture: Architecture;
  components: BenchComponent[];
  selectedId: string | null;
  setAuth: (user: LabUser | null, role: Role) => void;
  setArchitecture: (a: Architecture) => void;
  addComponent: (type: ComponentType) => void;
  removeComponent: (id: string) => void;
  select: (id: string | null) => void;
}

export const useLabStore = create<LabState>((set) => ({
  user: null,
  role: "guest",
  authReady: false,
  architecture: "arduino-uno",
  components: [{ id: "scope-1", type: "oscilloscope", position: [-2.2, 0, -0.9] }],
  selectedId: null,

  setAuth: (user, role) => set({ user, role, authReady: true }),
  setArchitecture: (architecture) => set({ architecture }),

  addComponent: (type) =>
    set((s) => {
      const n = s.components.length;
      const x = -1.2 + (n % 4) * 0.9;
      const z = 0.1 + Math.floor(n / 4) * 0.7;
      return {
        components: [
          ...s.components,
          { id: `${type}-${crypto.randomUUID().slice(0, 6)}`, type, position: [x, 0, z] },
        ],
      };
    }),

  removeComponent: (id) =>
    set((s) => ({
      components: s.components.filter((c) => c.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  select: (selectedId) => set({ selectedId }),
}));