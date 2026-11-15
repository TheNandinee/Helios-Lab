import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Architecture, BenchComponent, ProjectSnapshot, WireConnection } from "@/store/useLabStore";
import { validateWires } from "@/lib/wiring";

export interface ProjectSummary {
  id: string;
  name: string;
  architecture: Architecture;
  updatedAt: number;
  isTemplate: boolean;
}

function toProjectSummary(id: string, value: Record<string, unknown>): ProjectSummary {
  const updatedAt = value.updated_at as { toMillis?: () => number } | undefined;
  return {
    id,
    name: typeof value.name === "string" ? value.name : id,
    architecture: value.hardware_architecture as Architecture,
    updatedAt: updatedAt?.toMillis?.() ?? 0,
    isTemplate: value.is_template === true,
  };
}

export async function saveProject(opts: {
  projectId: string | null;
  uid: string;
  name: string;
  architecture: Architecture;
  components: BenchComponent[];
  wires?: WireConnection[];
  files: Record<string, string>;
}): Promise<string> {
  const ref = opts.projectId
    ? doc(db, "lab_projects", opts.projectId)
    : doc(collection(db, "lab_projects"));

  // JSON round-trip removes `undefined` values, which Firestore rejects.
  const components = JSON.parse(JSON.stringify(opts.components)) as BenchComponent[];
  const wires = validateWires(opts.wires ?? []);

  const data = {
    project_id: ref.id,
    owner_uid: opts.uid,
    name: opts.name.trim() || "Untitled lab",
    hardware_architecture: opts.architecture,
    diagram_json: { components, wires },
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

/** Lists a user's projects and published templates. Templates are queried separately so
 * Firestore Rules can prove each query's result set is readable. */
export async function listMyProjects(uid: string): Promise<ProjectSummary[]> {
  const projectsRef = collection(db, "lab_projects");
  const [mine, templates] = await Promise.all([
    getDocs(query(projectsRef, where("owner_uid", "==", uid))),
    getDocs(query(projectsRef, where("is_template", "==", true))),
  ]);
  const byId = new Map<string, ProjectSummary>();
  mine.docs.forEach((snapshot) => byId.set(snapshot.id, toProjectSummary(snapshot.id, snapshot.data())));
  templates.docs.forEach((snapshot) => byId.set(snapshot.id, toProjectSummary(snapshot.id, snapshot.data())));
  return [...byId.values()].sort((a, b) => Number(b.isTemplate) - Number(a.isTemplate) || b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<ProjectSnapshot> {
  const snap = await getDoc(doc(db, "lab_projects", id));
  if (!snap.exists()) throw new Error("Project not found");
  const value = snap.data();
  const isTemplate = value.is_template === true;
  return {
    // A template is opened as a copy. Saving it creates a student-owned document rather
    // than trying to overwrite the admin-owned template (which Firestore correctly blocks).
    id: isTemplate ? null : id,
    name: value.name ?? "Untitled lab",
    architecture: value.hardware_architecture as Architecture,
    components: (value.diagram_json?.components ?? []) as BenchComponent[],
    wires: validateWires(value.diagram_json?.wires ?? []),
    files: (value.source_code ?? {}) as Record<string, string>,
  };
}
