import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  const rules = await readFile(resolve(process.cwd(), "firestore.rules"), "utf8");
  env = await initializeTestEnvironment({
    projectId: "demo-helios-lab-rules",
    firestore: { rules },
  });
});

afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

async function seedSubmission(id: string, studentUid: string) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "submissions", id), {
      student_uid: studentUid, student_email: "student@example.com", project_id: "project-1",
      project_name: "Lab", hardware_architecture: "arduino-uno", source_code: { "sketch.ino": "void setup(){}" },
      status: "pending", score: null, submitted_at: new Date(),
    });
  });
}

describe("Firestore submission RBAC", () => {
  it("allows a student to submit only under their own UID", async () => {
    const student = env.authenticatedContext("student-a", { role: "student" }).firestore();
    await assertSucceeds(setDoc(doc(student, "submissions", "own"), {
      student_uid: "student-a", student_email: "a@example.com", project_id: "project-1", project_name: "Lab",
      hardware_architecture: "arduino-uno", source_code: { "sketch.ino": "void setup(){}" },
      status: "pending", score: null, submitted_at: new Date(),
    }));
    await assertFails(setDoc(doc(student, "submissions", "forged"), {
      student_uid: "student-b", project_id: "project-1", hardware_architecture: "arduino-uno",
      source_code: {}, status: "pending", score: null,
    }));
  });

  it("prevents students from reading other students' submissions or changing grades", async () => {
    await seedSubmission("other", "student-b");
    const student = env.authenticatedContext("student-a", { role: "student" }).firestore();
    await assertFails(getDoc(doc(student, "submissions", "other")));
    await assertFails(updateDoc(doc(student, "submissions", "other"), { score: 100, status: "graded" }));
  });

  it("allows instructors to read and grade submissions without changing submitted code", async () => {
    await seedSubmission("class-submission", "student-b");
    const instructor = env.authenticatedContext("teacher", { role: "instructor" }).firestore();
    await assertSucceeds(getDoc(doc(instructor, "submissions", "class-submission")));
    await assertSucceeds(updateDoc(doc(instructor, "submissions", "class-submission"), {
      status: "graded", score: 90, feedback: "Checks passed.",
    }));
    await assertFails(updateDoc(doc(instructor, "submissions", "class-submission"), {
      source_code: { "sketch.ino": "changed by staff" },
    }));
  });
});


describe("Firestore published template access", () => {
  it("allows signed-in students to query published templates", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "lab_projects", "template-blink"), {
        project_id: "template-blink", owner_uid: "admin-uid", name: "Blink",
        hardware_architecture: "arduino-uno", is_template: true,
        diagram_json: { components: [], wires: [] }, source_code: { "sketch.ino": "void setup(){}" },
      });
    });
    const student = env.authenticatedContext("student-a", { role: "student" }).firestore();
    const result = await getDocs(query(collection(student, "lab_projects"), where("is_template", "==", true)));
    expect(result.docs.map((snapshot) => snapshot.id)).toEqual(["template-blink"]);
  });
});
