import type { GradingSuite, Architecture, SourceFiles, CompileResult, GradeEvaluation } from "./gradeCode";
import { calculateGrade, evaluateRequiredChecks, mainSourceFile, validateForLocalArchitecture, validateSourceFiles } from "./gradeCode";

const WOKWI_BUILD_URL = "https://hexi.wokwi.com/build";
const WOKWI_TIMEOUT_MS = 45_000;

async function compileWithWokwi(sketch: string): Promise<CompileResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WOKWI_TIMEOUT_MS);
  try {
    const response = await fetch(WOKWI_BUILD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sketch }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload: { hex?: string; stdout?: string; stderr?: string; error?: string } = {};
    try { payload = JSON.parse(raw) as typeof payload; } catch { payload = { stderr: raw.slice(0, 8_000) }; }
    if (!response.ok) {
      return { ok: false, summary: `Wokwi build service returned HTTP ${response.status}.`, details: payload.stderr || payload.error || raw.slice(0, 8_000) };
    }
    if (!payload.hex) {
      return { ok: false, summary: "Wokwi did not return a compiled firmware image.", details: payload.stderr || payload.error || raw.slice(0, 8_000) };
    }
    return { ok: true, summary: "Wokwi compilation succeeded.", details: payload.stdout?.slice(0, 4_000) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, summary: "Could not reach the Wokwi build service.", details: message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function gradeSubmissionCode(
  architecture: Architecture,
  unknownFiles: unknown,
  suite: GradingSuite,
  compileSketch: (source: string) => Promise<CompileResult> = compileWithWokwi,
): Promise<GradeEvaluation> {
  const files: SourceFiles = validateSourceFiles(unknownFiles);
  const mainSource = mainSourceFile(architecture, files);
  let compile: CompileResult;
  if (architecture === "8051" || architecture === "jetson-nano") {
    compile = validateForLocalArchitecture(architecture, mainSource);
  } else {
    compile = await compileSketch(mainSource);
  }
  const evaluated = evaluateRequiredChecks(architecture, files, suite);
  const result = calculateGrade(compile, evaluated.checks, suite.compile_points);
  return { ...result, compile, checks: evaluated.checks };
}
