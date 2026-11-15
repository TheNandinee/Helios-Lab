import { describe, expect, it } from "vitest";
import { assemble } from "../../src/sim/i8051/assembler";

describe("8051 assembler", () => {
  it("assembles a labelled LED output loop", () => {
    const source = `ORG 0000H\nSTART: MOV P1, #01H\nSJMP START\nEND`;
    const result = assemble(source);
    expect(result.errors).toEqual([]);
    expect(result.size).toBe(5);
    expect(Array.from(result.image.slice(0, 5))).toEqual([0x75, 0x90, 0x01, 0x80, 0xfb]);
  });

  it("reports invalid instructions with their source line", () => {
    const result = assemble("ORG 0000H\nNOT_AN_INSTRUCTION A\nEND");
    expect(result.errors.some((error) => error.line === 2 && error.message.includes("Unknown instruction"))).toBe(true);
  });

  it("reports duplicate labels", () => {
    const result = assemble("ORG 0000H\nLOOP: NOP\nLOOP: RET\nEND");
    expect(result.errors.some((error) => error.line === 3 && error.message.includes("Duplicate label"))).toBe(true);
  });
});
