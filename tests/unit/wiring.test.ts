import { describe, expect, it } from "vitest";
import { fromWokwiDiagram, toWokwiDiagram, validateWires } from "../../src/lib/wiring";
import type { BenchComponent, WireConnection } from "../../src/store/useLabStore";

const components: BenchComponent[] = [
  { id: "uno", type: "arduino-uno", position: [0, 0, 0] },
  { id: "led", type: "led", position: [1, 0, 0], pin: "D13", color: "red" },
];
const wires: WireConnection[] = [{ from: "uno:13", to: "led:A", color: "green", route: ["v10", "h5", "*"] }];

describe("Firestore/Wokwi wiring conversion", () => {
  it("uses Wokwi left/top coordinates and four-item connection tuples", () => {
    const diagram = toWokwiDiagram(components, wires);
    expect(diagram.parts[0]).toMatchObject({ type: "wokwi-arduino-uno", left: 400, top: 300 });
    expect(diagram.parts[1]).toMatchObject({ type: "wokwi-led", left: 500, top: 300 });
    expect(diagram.connections).toEqual([["uno:13", "led:A", "green", ["v10", "h5", "*"]]]);
    expect(fromWokwiDiagram(diagram)).toEqual({ components, wires });
  });

  it("accepts a standard Wokwi diagram with no explicit route", () => {
    const imported = fromWokwiDiagram({
      parts: [{ type: "wokwi-arduino-uno", id: "uno", left: 400, top: 300 }, { type: "wokwi-led", id: "led", left: 500, top: 300 }],
      connections: [["uno:13", "led:A", "green", []]],
    });
    expect(imported.wires).toEqual([{ from: "uno:13", to: "led:A", color: "green" }]);
  });

  it("rejects nested arrays instead of Firestore-safe wire objects", () => {
    expect(() => validateWires([["uno:13", "led:A", "green"]] as unknown as WireConnection[])).toThrow(/must be an object/);
  });

  it("rejects references to components that are not on the bench", () => {
    expect(() => toWokwiDiagram(components, [{ from: "missing:1", to: "led:A", color: "red" }])).toThrow(/not on the bench/);
  });

  it("rejects malformed Wokwi wire routes", () => {
    expect(() => validateWires([{ from: "uno:13", to: "led:A", color: "green", route: ["v10", "*", "*"] }])).toThrow(/at most one/);
  });

  it("rejects Helios-only components instead of exporting an invalid stock Wokwi part", () => {
    expect(() => toWokwiDiagram([{ id: "mcu", type: "mcu-8051", position: [0, 0, 0] }], [])).toThrow(/no stock Wokwi equivalent/);
  });
});
