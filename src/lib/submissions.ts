import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Architecture } from "@/store/useLabStore";

export interface Submission {
  id: string;
  studentUid: string;
  studentEmail: string;
  projectId: string;
  projectName: string;
  architecture: Architecture;
  status: string;
  score: number | null;
  feedback: string;
  submittedAt: number;
}

function toSubmission(id: string, v: DocumentData): Submission {
  return {
    id,
    studentUid: v.student_uid,
    studentEmail: v.student_email ?? "",
    projectId: v.project_id,
    projectName: v.project_name ?? v.project_id,
    architecture: v.hardware_architecture,
    status: v.status ?? "pending",
    score: typeof v.score === "number" ? v.score : null,
    feedback: v.feedback ?? "",
    submittedAt: v.submitted_at?.toMillis?.() ?? 0,
  };
}

export async function submitLab(p: {
  uid: string; email: string | null; projectId: string; projectName: string;
  architecture: Architecture; files: Record<string, string>;
}) {
  await addDoc(collection(db, "submissions"), {
    student_uid: p.uid,
    student_email: p.email,
    project_id: p.projectId,
    project_name: p.projectName,
    hardware_architecture: p.architecture,
    source_code: p.files,
    status: "pending",
    score: null,
    submitted_at: serverTimestamp(),
  });
}

export async function listAllSubmissions(): Promise<Submission[]> {
  const snap = await getDocs(query(collection(db, "submissions"), orderBy("submitted_at", "desc"), limit(200)));
  return snap.docs.map((d) => toSubmission(d.id, d.data()));
}

export async function listMySubmissions(uid: string): Promise<Submission[]> {
  const snap = await getDocs(query(collection(db, "submissions"), where("student_uid", "==", uid)));
  return snap.docs.map((d) => toSubmission(d.id, d.data())).sort((a, b) => b.submittedAt - a.submittedAt);
}