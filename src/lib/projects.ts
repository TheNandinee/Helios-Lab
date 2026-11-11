import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Architecture, BenchComponent, ProjectSnapshot } from "@/store/useLabStore";

export interface ProjectSummary {
  id: string;
  name: string;
  architecture: Architecture;
  updatedAt: number;
}

export async function saveProject(opts: {
  projectId: string | null;
  uid: string;
  name: string;
  architecture: Architecture;
  components: BenchComponent[];
  files: Record<string, string>;
}): Promise<string> {
  const ref = opts.projectId
    ? doc(db, "lab_projects", opts.projectId)
    : doc(collection(db, "lab_projects"));

  // JSON round-trip removes `undefined` values, which Firestore rejects
  const components = JSON.parse(JSON.stringify(opts.components)) as BenchComponent[];

  const data = {
    project_id: ref.id,
    owner_uid: opts.uid,
    name: opts.name.trim() || "Untitled lab",
    hardware_architecture: opts.architecture,
    diagram_json: { components, wires: [] },
    source_code: opts.files,
    updated_at: serverTimestamp(),
  };

  if (opts.projectId) {
    await setDoc(ref, data, {
      mergeFields: ["project_id", "owner_uid", "name", "hardware_architecture", "diagram_json", "source_code", "updated_at"],
    });
  } else {
    await setDoc(ref, { ...data, created_at: serverTimestamp() });
  }
  return ref.id;
}

export async function listMyProjects(uid: string): Promise<ProjectSummary[]> {
  const snap = await getDocs(query(collection(db, "lab_projects"), where("owner_uid", "==", uid)));
  return snap.docs
    .map((d) => {
      const v = d.data();
      return {
        id: d.id,
        name: v.name ?? d.id,
        architecture: v.hardware_architecture as Architecture,
        updatedAt: v.updated_at?.toMillis?.() ?? 0,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<ProjectSnapshot> {
  const snap = await getDoc(doc(db, "lab_projects", id));
  if (!snap.exists()) throw new Error("Project not found");
  const v = snap.data();
  return {
    id,
    name: v.name ?? "Untitled lab",
    architecture: v.hardware_architecture as Architecture,
    components: (v.diagram_json?.components ?? []) as BenchComponent[],
    files: (v.source_code ?? {}) as Record<string, string>,
  };
}