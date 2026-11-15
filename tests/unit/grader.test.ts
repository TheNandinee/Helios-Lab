import { describe, expect, it } from "vitest";
import { calculateGrade, evaluateRequiredChecks, getGradingSuite } from "../../functions/src/grader/gradeCode";

describe("grading checks", () => {
  it("scores passing and failing static rubric checks", () => {
    const suite = getGradingSuite("arduino-uno");
    const evaluation = evaluateRequiredChecks("arduino-uno", {
      "sketch.ino": "void setup(){ pinMode(13, OUTPUT); } void loop(){ digitalWrite(13, HIGH); }",
    }, suite);
    expect(evaluation.earned).toBe(40);
    const result = calculateGrade({ ok: true, summary: "Compiled" }, evaluation.checks, suite.compile_points);
    expect(result.status).toBe("graded");
    expect(result.score).toBe(80);
    expect(result.feedback).toContain("2/3 passed");
  });

  it("assigns zero and failed status when compilation fails", () => {
    const suite = getGradingSuite("8051");
    const result = calculateGrade({ ok: false, summary: "Assembly failed", details: "Line 4: unknown opcode" }, [], suite.compile_points);
    expect(result.status).toBe("failed");
    expect(result.score).toBe(0);
    expect(result.feedback).toContain("Line 4");
  });
});
