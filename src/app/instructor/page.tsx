"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { listAllSubmissions, type Submission } from "@/lib/submissions";

export default function InstructorPage() {
  const { authReady, role } = useLabStore(useShallow((s) => ({ authReady: s.authReady, role: s.role })));
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [error, setError] = useState("");
  const isStaff = role === "instructor" || role === "admin";

  useEffect(() => {
    if (!isStaff) return;
    listAllSubmissions().then(setRows).catch((e) => setError(String(e)));
  }, [isStaff]);

  if (!authReady) return <div className="flex h-screen items-center justify-center text-slate-400">Connecting…</div>;

  if (!isStaff) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-slate-300">This dashboard is for instructors and admins only.</p>
        <Link href="/lab" className="text-sky-400 underline">Back to the lab</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Instructor dashboard</h1>
        <Link href="/lab" className="rounded border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800">Open lab</Link>
      </div>
      {error && <p className="text-red-400">{error}</p>}
      {!rows ? (
        <p className="text-slate-400">Loading submissions…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400">No submissions yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="py-2">Student</th><th>Project</th><th>Board</th><th>Submitted</th>
              <th>Status</th><th>Score</th><th>Feedback</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="py-2">{r.studentEmail}</td>
                <td>{r.projectName}</td>
                <td>{r.architecture}</td>
                <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "–"}</td>
                <td>{r.status}</td>
                <td>{r.score ?? "–"}</td>
                <td className="max-w-xs truncate text-slate-400">{r.feedback}</td>
                <td><Link href={`/lab?project=${r.projectId}`} className="text-sky-400 underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}