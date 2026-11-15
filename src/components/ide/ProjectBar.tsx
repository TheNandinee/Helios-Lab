
"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import {
  listMyProjects,
  loadProject,
  saveProject,
  type ProjectSummary,
} from "@/lib/projects";
import {
  fromWokwiDiagram,
  toWokwiDiagram,
  type WokwiDiagram,
} from "@/lib/wiring";
import { stopSimulation } from "@/sim/controller";

export default function ProjectBar() {
  const {
    user,
    projectId,
    projectName,
    setProjectName,
    setProjectMeta,
    newProject,
    loadSnapshot,
  } = useLabStore(
    useShallow((s) => ({
      user: s.user,
      projectId: s.projectId,
      projectName: s.projectName,
      setProjectName: s.setProjectName,
      setProjectMeta: s.setProjectMeta,
      newProject: s.newProject,
      loadSnapshot: s.loadSnapshot,
    }))
  );

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsForUid, setProjectsForUid] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const importInput = useRef<HTMLInputElement>(null);

  const uid = user?.uid;

  // Hide previously loaded projects when the signed-in user changes.
  const visibleProjects =
    uid && projectsForUid === uid ? projects : [];

  // Load projects asynchronously without setting state synchronously
  // inside the effect.
  useEffect(() => {
    if (!uid) return;

    let cancelled = false;

    listMyProjects(uid)
      .then((items) => {
        if (!cancelled) {
          setProjects(items);
          setProjectsForUid(uid);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(
            error instanceof Error ? error.message : String(error)
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function refreshProjects() {
    if (!uid) return;

    const items = await listMyProjects(uid);
    setProjects(items);
    setProjectsForUid(uid);
  }

  async function handleSave() {
    if (!user) return;

    setStatus("Saving…");

    try {
      const state = useLabStore.getState();

      const id = await saveProject({
        projectId: state.projectId,
        uid: user.uid,
        name: state.projectName,
        architecture: state.architecture,
        components: state.components,
        wires: state.wires,
        files: state.files,
      });

      setProjectMeta(id, state.projectName);
      setStatus("Saved ✓");

      await refreshProjects();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Save failed"
      );
    }
  }

  async function handleOpen(id: string) {
    if (!id) return;

    stopSimulation();
    setStatus("Loading…");

    try {
      const snapshot = await loadProject(id);
      loadSnapshot(snapshot);
      setStatus("Loaded ✓ (templates open as copies)");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Load failed"
      );
    }
  }

  function handleExportWokwi() {
    try {
      const state = useLabStore.getState();

      const diagram = toWokwiDiagram(
        state.components,
        state.wires,
        user?.displayName || "Helios Lab"
      );

      const blob = new Blob(
        [JSON.stringify(diagram, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = "diagram.json";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 0);

      setStatus("Wokwi diagram exported ✓");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Wokwi export failed"
      );
    }
  }

  async function handleImportWokwi(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setStatus("Importing Wokwi diagram…");

    try {
      const parsed = JSON.parse(
        await file.text()
      ) as WokwiDiagram;

      const converted = fromWokwiDiagram(parsed);
      const current = useLabStore.getState();

      const architecture = converted.components.some(
        (component) => component.type === "esp32"
      )
        ? "esp32"
        : converted.components.some(
              (component) => component.type === "arduino-uno"
            )
          ? "arduino-uno"
          : current.architecture;

      stopSimulation();

      loadSnapshot({
        id: null,
        name: file.name.replace(/\.json$/i, "") || current.projectName,
        architecture,
        components: converted.components,
        wires: converted.wires,
        files: current.files,
      });

      setStatus(
        `Imported ${converted.components.length} parts and ${converted.wires.length} wires ✓`
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Wokwi import failed"
      );
    }
  }

  return (
    <div className="glass rounded-xl p-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={projectName}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setProjectName(event.target.value)
          }
          className="min-w-32 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
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
          onClick={() => {
            stopSimulation();
            newProject();
            setStatus("");
          }}
          className="rounded-md border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
        >
          New
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value=""
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            handleOpen(event.target.value)
          }
          disabled={!user || visibleProjects.length === 0}
          className="min-w-40 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm disabled:opacity-40"
        >
          <option value="">
            {user
              ? `Open project or template (${visibleProjects.length})`
              : "Sign in to open projects"}
          </option>

          {visibleProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.isTemplate ? "Template · " : ""}
              {project.name} · {project.architecture}
            </option>
          ))}
        </select>

        <span className="text-xs text-slate-400">
          {status || (projectId ? "Saved project" : "Unsaved")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExportWokwi}
          className="rounded-md border border-slate-600 px-3 py-1 text-xs hover:bg-slate-800"
        >
          Export Wokwi diagram.json
        </button>

        <button
          type="button"
          onClick={() => importInput.current?.click()}
          className="rounded-md border border-slate-600 px-3 py-1 text-xs hover:bg-slate-800"
        >
          Import Wokwi diagram.json
        </button>

        <input
          ref={importInput}
          type="file"
          accept="application/json,.json"
          onChange={handleImportWokwi}
          className="hidden"
          aria-label="Import Wokwi diagram JSON file"
        />
      </div>
    </div>
  );
}
