import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger, setGlobalOptions } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import suites from "../../config/grading-test-suites.json";
import { gradeSubmissionCode } from "./grader/gradeSubmission";
import type { Architecture, GradingSuite } from "./grader/gradeCode";

if (getApps().length === 0) initializeApp();
const db = getFirestore();
const ALLOWED_ARCHITECTURES = new Set<Architecture>(["8051", "arduino-uno", "esp32", "jetson-nano"]);
const STALE_GRADING_LEASE_MS = 15 * 60 * 1000;

setGlobalOptions({ region: "asia-south1", maxInstances: 5 });

function isArchitecture(value: unknown): value is Architecture {
  return typeof value === "string" && ALLOWED_ARCHITECTURES.has(value as Architecture);
}

function safeFeedback(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Auto-grader could not complete this submission: ${detail.slice(0, 1_500)}`;
}

function fallbackSuite(architecture: Architecture): GradingSuite {
  return suites[architecture] as GradingSuite;
}

export const gradeNewSubmission = onDocumentCreated(
  {
    document: "submissions/{submissionId}",
    region: "asia-south1",
    timeoutSeconds: 120,
    memory: "512MiB",
    maxInstances: 5,
    retry: true,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const submissionRef = snapshot.ref;
    const submissionId = event.params.submissionId;

    // A Firestore event may be delivered more than once. Claim the document atomically.
    const claimed = await db.runTransaction(async (tx) => {
      const current = await tx.get(submissionRef);
      if (!current.exists) return false;
      const data = current.data()!;
      const status = data.status ?? "pending";
      if (status === "graded" || status === "failed") return false;
      if (status === "grading") {
        const started = data.grading_started_at?.toMillis?.() ?? 0;
        if (started && Date.now() - started < STALE_GRADING_LEASE_MS) {
          // Do not acknowledge a duplicate event while another invocation owns the lease.
          // Throwing keeps the event retryable if the original invocation later crashes.
          throw new Error(`Submission ${submissionId} is already being graded; retry after the active lease.`);
        }
        logger.warn("Reclaiming a stale grading lease", { submissionId, started });
      } else if (status !== "pending") {
        logger.warn("Ignoring submission with unexpected initial status", { submissionId, status });
        return false;
      }
      tx.update(submissionRef, {
        status: "grading",
        grading_started_at: FieldValue.serverTimestamp(),
        grading_attempts: FieldValue.increment(1),
      });
      return true;
    });
    if (!claimed) {
      logger.info("Submission was already claimed or graded", { submissionId });
      return;
    }

    try {
      const current = await submissionRef.get();
      const data = current.data();
      if (!data) throw new Error("Submission disappeared during grading.");
      if (!isArchitecture(data.hardware_architecture)) throw new Error("Unsupported hardware_architecture.");
      const architecture = data.hardware_architecture;
      const suiteSnapshot = await db.collection("test_suites").doc(`suite_${architecture}`).get();
      const suite = suiteSnapshot.exists ? suiteSnapshot.data() as GradingSuite : fallbackSuite(architecture);
      if (!suiteSnapshot.exists) logger.warn("Test suite document not found; using the checked-in default suite", { architecture });

      const result = await gradeSubmissionCode(architecture, data.source_code, suite);
      await submissionRef.update({
        status: result.status,
        score: result.score,
        feedback: result.feedback,
        grading_result: {
          compile: result.compile,
          checks: result.checks,
          suite_name: suite.name,
          hardware_architecture: architecture,
        },
        graded_at: FieldValue.serverTimestamp(),
      });
      logger.info("Submission graded", { submissionId, architecture, status: result.status, score: result.score });
    } catch (error) {
      const feedback = safeFeedback(error);
      await submissionRef.update({
        status: "failed",
        score: 0,
        feedback,
        grading_result: { error: feedback },
        graded_at: FieldValue.serverTimestamp(),
      });
      logger.error("Submission grading failed", { submissionId, error });
    }
  },
);
