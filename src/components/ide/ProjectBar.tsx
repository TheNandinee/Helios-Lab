"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { listMyProjects, loadProject, saveProject, type ProjectSummary } from "@/lib/projects";
import { stopSimulation } from "@/sim/controller";

export default function ProjectBar() {
  const { user, projectId, projectName, setProjectName, setProjectMeta, newProject, loadSnapshot } = useLabStore(
    useShallow((s) => ({
      user: s.user, projectId: s.projectId, projectName: s.projectName,
      setProjectName: s.setProjectName, setProjectMeta: s.setProjectMeta,
      newProject: s.newProject, loadSnapshot: s.loadSnapshot,
    }))
  );
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    listMyProjects(user.uid).then(setProjects).catch((e) => setStatus(String(e)));
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setStatus("Saving…");
    try {
      const s = useLabStore.getState();
      const id = await saveProject({
        projectId: s.projectId, uid: user.uid, name: s.projectName,
        architecture: s.architecture, components: s.components, files: s.files,
      });
      setProjectMeta(id, s.projectName);
      setStatus("Saved ✓");
      setProjects(await listMyProjects(user.uid));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleOpen(id: string) {
    if (!id) return;
    stopSimulation();
    setStatus("Loading…");
    try {
      loadSnapshot(await loadProject(id));
      setStatus("Loaded ✓");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Load failed");
    }
  }

  return (
    <div className="glass rounded-xl p-2 space-y-2">
      <div className="flex gap-2">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          placeholder="Project name"
        />
        <button
          onClick={handleSave}
          disabled={!user}
          title={user ? "Save to Firestore" : "Sign in to save"}
          className="rounded-md bg-sky-500 px-3 py-1 text-sm font-semibold text-slate-950 disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={() => { stopSimulation(); newProject(); setStatus(""); }}
          className="rounded-md border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
        >
          New
        </button>
      </div>
      <div className="flex items-center gap-2">
        <select
          value=""
          onChange={(e) => handleOpen(e.target.value)}
          disabled={!user || projects.length === 0}
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm disabled:opacity-40"
        >
          <option value="">{user ? `Open project (${projects.length})` : "Sign in to open projects"}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name} · {p.architecture}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{status || (projectId ? "Saved project" : "Unsaved")}</span>
      </div>
    </div>
  );
}