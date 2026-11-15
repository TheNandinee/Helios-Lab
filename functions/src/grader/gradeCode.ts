import suites from "../../../config/grading-test-suites.json";
import { assemble } from "../../../src/sim/i8051/assembler";
import { parseJetsonConfig } from "../../../src/sim/jetson";

export type Architecture = "8051" | "arduino-uno" | "esp32" | "jetson-nano";
export interface SourceFiles { [filename: string]: string; }
export interface GradingCheck { id: string; label: string; contains: string; points: number; }
export interface GradingSuite { name: string; compile_points: number; checks: GradingCheck[]; }
export interface CheckResult { id: string; label: string; passed: boolean; points: number; earned: number; }
export interface CompileResult { ok: boolean; summary: string; details?: string; }
export interface GradeEvaluation {
  status: "graded" | "failed";
  score: number;
  feedback: string;
  compile: CompileResult;
  checks: CheckResult[];
}

export const BUILT_IN_SUITES = suites as Record<Architecture, GradingSuite>;
const MAX_TOTAL_SOURCE_CHARS = 200_000;

export function validateSourceFiles(value: unknown): SourceFiles {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("source_code must be a filename-to-code object.");
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) throw new Error("The submission contains no source files.");
  let total = 0;
  const output: SourceFiles = {};
  for (const [name, content] of entries) {
    if (!name || typeof content !== "string") throw new Error("Every source_code entry must have a filename and string content.");
    total += content.length;
    if (content.length > 100_000) throw new Error(`${name} exceeds the 100 KB per-file limit.`);
    output[name] = content;
  }
  if (total > MAX_TOTAL_SOURCE_CHARS) throw new Error("The combined source files exceed the 200 KB submission limit.");
  return output;
}

export function mainSourceFile(architecture: Architecture, files: SourceFiles): string {
  const names = Object.keys(files);
  const preferred = architecture === "8051" ? /\.(asm|a51)$/i
    : architecture === "jetson-nano" ? /\.py$/i : /\.(ino|cpp|c)$/i;
  const filename = names.find((name) => preferred.test(name));
  if (!filename) throw new Error(`No source file found for ${architecture}. Expected ${preferred}.`);
  return files[filename];
}

function stripComments(source: string, architecture: Architecture): string {
  let text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  if (architecture === "8051") text = text.replace(/;.*$/gm, "");
  else if (architecture === "jetson-nano") text = text.replace(/^\s*#(?!include).*$/gm, "");
  else text = text.replace(/(^|[^:])\/\/.*$/gm, "$1");
  return text;
}

function normalize(source: string, architecture: Architecture): string {
  return stripComments(source, architecture).toLowerCase().replace(/\s+/g, "");
}

export function evaluateRequiredChecks(
  architecture: Architecture,
  sourceFiles: SourceFiles,
  suite: GradingSuite,
): { checks: CheckResult[]; earned: number; possible: number } {
  const combined = normalize(Object.values(sourceFiles).join("\n"), architecture);
  const checks = suite.checks.map((check) => {
    if (!check.id || !check.label || typeof check.contains !== "string" || !Number.isFinite(check.points) || check.points < 0) {
      throw new Error(`Invalid check definition in grading suite "${suite.name}".`);
    }
    const passed = combined.includes(normalize(check.contains, architecture));
    return { id: check.id, label: check.label, passed, points: check.points, earned: passed ? check.points : 0 };
  });
  return {
    checks,
    earned: checks.reduce((sum, check) => sum + check.earned, 0),
    possible: checks.reduce((sum, check) => sum + check.points, 0),
  };
}

export function validateForLocalArchitecture(architecture: Architecture, source: string): CompileResult {
  if (architecture === "8051") {
    const result = assemble(source);
    if (result.errors.length) {
      return { ok: false, summary: `8051 assembly failed with ${result.errors.length} error(s).`, details: result.errors.map((e) => `Line ${e.line}: ${e.message}`).join("\n") };
    }
    return { ok: true, summary: `8051 assembly succeeded (${result.size} byte(s)).` };
  }
  if (architecture === "jetson-nano") {
    try {
      const config = parseJetsonConfig(source);
      return { ok: true, summary: `Jetson configuration parsed (model ${config.model}, ${config.fps} FPS).` };
    } catch (error) {
      return { ok: false, summary: "Jetson configuration validation failed.", details: error instanceof Error ? error.message : String(error) };
    }
  }
  throw new Error(`Architecture ${architecture} requires the Wokwi compile service.`);
}

export function calculateGrade(compile: CompileResult, checks: CheckResult[], compilePoints: number): { status: "graded" | "failed"; score: number; feedback: string } {
  if (!compile.ok) {
    const feedback = [compile.summary, compile.details].filter(Boolean).join("\n");
    return { status: "failed", score: 0, feedback };
  }
  const possibleChecks = checks.reduce((sum, c) => sum + c.points, 0);
  const earnedChecks = checks.reduce((sum, c) => sum + c.earned, 0);
  const compileWeight = Math.max(0, Math.min(100, compilePoints));
  const checksWeight = 100 - compileWeight;
  const checkScore = possibleChecks > 0 ? (earnedChecks / possibleChecks) * checksWeight : checksWeight;
  const score = Math.round(compileWeight + checkScore);
  const lines = [compile.summary, `Required checks: ${checks.filter((c) => c.passed).length}/${checks.length} passed.`];
  for (const c of checks) lines.push(`${c.passed ? "PASS" : "FAIL"}: ${c.label} (${c.earned}/${c.points})`);
  return { status: "graded", score: Math.max(0, Math.min(100, score)), feedback: lines.join("\n") };
}

export function getGradingSuite(architecture: Architecture): GradingSuite {
  const suite = BUILT_IN_SUITES[architecture];
  if (!suite) throw new Error(`No grading suite is configured for ${architecture}.`);
  return suite;
}
