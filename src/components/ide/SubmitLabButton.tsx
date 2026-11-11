"use client";

import { useState } from "react";
import { useLabStore } from "@/store/useLabStore";
import { submitLab } from "@/lib/submissions";

export default function SubmitLabButton() {
  const user = useLabStore((s) => s.user);
  const [status, setStatus] = useState("");
  if (!user) return null;

  async function handleSubmit() {
    const s = useLabStore.getState();
    if (!s.projectId || !s.user) { setStatus("Save the project first"); return; }
    setStatus("Submitting…");
    try {
      await submitLab({
        uid: s.user.uid, email: s.user.email, projectId: s.projectId, projectName: s.projectName,
        architecture: s.architecture, files: s.files,
      });
      setStatus("Submitted ✓ The auto-grader will score it");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Submit failed");
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <button onClick={handleSubmit} className="rounded-md bg-violet-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-violet-400">
        Submit lab
      </button>
      <span className="text-slate-400">{status}</span>
    </div>
  );
}