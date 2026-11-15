import { describe, expect, it } from "vitest";
import { modelLatency, parseJetsonConfig } from "../../src/sim/jetson";

const validConfig = `MODEL = "ssd-mobilenet-v2"\nCLASSES = ["person", "car"]\nCONFIDENCE_THRESHOLD = 0.55\nCAMERA_FPS = 30\nSHOW_LABELS = True`;

describe("Jetson configuration parser", () => {
  it("parses a valid configuration", () => {
    expect(parseJetsonConfig(validConfig)).toEqual({
      model: "ssd-mobilenet-v2", classes: ["person", "car"], threshold: 0.55, fps: 30, showLabels: true,
    });
  });

  it("rejects unsupported models and out-of-range thresholds", () => {
    expect(() => parseJetsonConfig("MODEL = 'made-up-model'\nCONFIDENCE_THRESHOLD = 2")).toThrow(/MODEL must be one of/);
    expect(() => parseJetsonConfig("CONFIDENCE_THRESHOLD = 2")).toThrow(/between 0 and 1/);
  });

  it("uses the documented fallback latency for unknown models", () => {
    expect(modelLatency("not-a-model")).toBe(30);
  });
});
