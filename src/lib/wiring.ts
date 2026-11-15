import type { BenchComponent, ComponentType, WireConnection } from "@/store/useLabStore";

/** Wokwi's diagram.json part coordinates are pixel-based left/top values. */
export interface WokwiPart {
  type: string;
  id: string;
  left?: number;
  top?: number;
  attrs?: Record<string, string | number | boolean>;
  rotate?: number;
  hide?: boolean;
}

/** Wokwi's fourth connection item is a list of routing instructions such as v10, h5, *. */
export type WokwiConnection = [from: string, to: string, color: string, route?: string[]];

export interface WokwiDiagram {
  version: 1;
  author: string;
  editor: "wokwi";
  parts: WokwiPart[];
  connections: WokwiConnection[];
}

// This adapter only exports components with a real Wokwi part type. 8051 and
// Jetson are simulated by Helios Lab and do not have equivalent stock Wokwi parts.
const PART_TYPES: Partial<Record<ComponentType, string>> = {
  "arduino-uno": "wokwi-arduino-uno",
  esp32: "wokwi-esp32-devkit-v1",
  led: "wokwi-led",
  button: "wokwi-pushbutton",
  oscilloscope: "wokwi-logic-analyzer",
};
const COMPONENT_TYPES = Object.fromEntries(
  Object.entries(PART_TYPES).map(([component, part]) => [part, component]),
) as Record<string, ComponentType>;

// Map the 3-D workbench's world coordinates to a stable, centered Wokwi canvas.
// The inverse mapping below ensures an exported/imported diagram round-trips.
const POSITION_SCALE = 100;
const CANVAS_ORIGIN = { left: 400, top: 300 };

function assertPinReference(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+:[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error(`${label} must use componentId:pin format.`);
  }
}

/** Validate and clone the Firestore-safe wire objects used by the app. */
export function validateWires(wires: WireConnection[]): WireConnection[] {
  if (!Array.isArray(wires)) throw new Error("Wires must be an array of wire objects.");
  return wires.map((wire, index) => {
    if (!wire || typeof wire !== "object" || Array.isArray(wire)) throw new Error(`Wire ${index + 1} must be an object.`);
    assertPinReference(wire.from, `Wire ${index + 1} source`);
    assertPinReference(wire.to, `Wire ${index + 1} destination`);
    if (wire.from === wire.to) throw new Error(`Wire ${index + 1} cannot connect a pin to itself.`);
    if (typeof wire.color !== "string") throw new Error(`Wire ${index + 1} needs a color string.`);
    if (wire.points !== undefined && (!Array.isArray(wire.points) || wire.points.some((n) => typeof n !== "number" || !Number.isFinite(n)))) {
      throw new Error(`Wire ${index + 1} points must be a flat array of finite numbers.`);
    }
    if (wire.route !== undefined) {
      if (!Array.isArray(wire.route) || wire.route.some((step) => typeof step !== "string" || !/^(?:[vh]-?(?:\d+\.?\d*|\.\d+)|\*)$/.test(step))) {
        throw new Error(`Wire ${index + 1} route must contain Wokwi instructions (vN, hN, or *).`);
      }
      if (wire.route.filter((step) => step === "*").length > 1) {
        throw new Error(`Wire ${index + 1} route can contain at most one * instruction.`);
      }
    }
    return {
      from: wire.from,
      to: wire.to,
      color: wire.color,
      ...(wire.points ? { points: [...wire.points] } : {}),
      ...(wire.route ? { route: [...wire.route] } : {}),
    };
  });
}

function assertUniqueComponents(components: BenchComponent[]) {
  const ids = new Set<string>();
  for (const component of components) {
    if (!component.id || ids.has(component.id)) throw new Error(`Component IDs must be non-empty and unique (duplicate: ${component.id}).`);
    ids.add(component.id);
  }
  return ids;
}

/** Convert the Helios model to Wokwi's documented diagram.json structure. */
export function toWokwiDiagram(components: BenchComponent[], wires: WireConnection[], author = "Helios Lab"): WokwiDiagram {
  const ids = assertUniqueComponents(components);
  const normalizedWires = validateWires(wires);
  const parts: WokwiPart[] = components.map((component) => {
    const partType = PART_TYPES[component.type];
    if (!partType) {
      throw new Error(`The ${component.type} component has no stock Wokwi equivalent and cannot be exported.`);
    }
    const attrs: Record<string, string | number | boolean> = {};
    if (component.pin) attrs.pin = component.pin;
    if (component.color) attrs.color = component.color;
    if (component.activeLow !== undefined) attrs.activeLow = component.activeLow;
    return {
      type: partType,
      id: component.id,
      left: Math.round(CANVAS_ORIGIN.left + component.position[0] * POSITION_SCALE),
      top: Math.round(CANVAS_ORIGIN.top + component.position[2] * POSITION_SCALE),
      attrs,
    };
  });
  for (const wire of normalizedWires) {
    const fromId = wire.from.slice(0, wire.from.indexOf(":"));
    const toId = wire.to.slice(0, wire.to.indexOf(":"));
    if (!ids.has(fromId) || !ids.has(toId)) {
      throw new Error(`Wire references a component not on the bench: ${wire.from} -> ${wire.to}.`);
    }
  }
  return {
    version: 1,
    author: author.trim() || "Helios Lab",
    editor: "wokwi",
    parts,
    connections: normalizedWires.map((wire) => [wire.from, wire.to, wire.color, wire.route ?? []]),
  };
}

/** Convert Wokwi diagram.json into the app's Firestore-safe object model. */
export function fromWokwiDiagram(diagram: Partial<WokwiDiagram>): { components: BenchComponent[]; wires: WireConnection[] } {
  if (!Array.isArray(diagram.parts) || !Array.isArray(diagram.connections)) {
    throw new Error("Wokwi diagram must contain parts and connections arrays.");
  }
  const components = diagram.parts.map((part): BenchComponent => {
    const inferred = COMPONENT_TYPES[part.type];
    if (!inferred) throw new Error(`Unsupported Wokwi part type "${part.type}".`);
    if (typeof part.id !== "string" || !part.id.trim()) throw new Error("Every Wokwi part needs an id.");
    const left = Number.isFinite(part.left) ? Number(part.left) : CANVAS_ORIGIN.left;
    const top = Number.isFinite(part.top) ? Number(part.top) : CANVAS_ORIGIN.top;
    return {
      id: part.id,
      type: inferred,
      position: [(left - CANVAS_ORIGIN.left) / POSITION_SCALE, 0, (top - CANVAS_ORIGIN.top) / POSITION_SCALE],
      ...(typeof part.attrs?.pin === "string" ? { pin: part.attrs.pin } : {}),
      ...(typeof part.attrs?.color === "string" ? { color: part.attrs.color } : {}),
      ...(typeof part.attrs?.activeLow === "boolean" ? { activeLow: part.attrs.activeLow } : {}),
    };
  });
  assertUniqueComponents(components);
  const wires = validateWires(diagram.connections.map((connection, index) => {
    if (!Array.isArray(connection) || connection.length < 2 || connection.length > 4) {
      throw new Error(`Wokwi connection ${index + 1} is malformed.`);
    }
    const route = connection[3];
    if (route !== undefined && (!Array.isArray(route) || route.some((step) => typeof step !== "string"))) {
      throw new Error(`Wokwi connection ${index + 1} has an invalid route.`);
    }
    return {
      from: String(connection[0]),
      to: String(connection[1]),
      color: String(connection[2] ?? "green"),
      ...(route && route.length ? { route } : {}),
    };
  }));
  const ids = new Set(components.map((component) => component.id));
  for (const wire of wires) {
    if (!ids.has(wire.from.split(":", 1)[0]) || !ids.has(wire.to.split(":", 1)[0])) {
      throw new Error(`Wire references an unknown component: ${wire.from} -> ${wire.to}.`);
    }
  }
  return { components, wires };
}
