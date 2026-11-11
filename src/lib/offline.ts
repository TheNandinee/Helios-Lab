"use client";

import { useEffect } from "react";
import { useLabStore, type ProjectSnapshot } from "@/store/useLabStore";

const DRAFT_KEY = "helios:draft";

export function restoreDraft(): boolean {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw) as ProjectSnapshot;
    if (!d.files || !d.components || !d.architecture) return false;
    useLabStore.getState().loadSnapshot(d);
    return true;
  } catch {
    return false;
  }
}

/** Saves the bench + code to localStorage 800 ms after every change */
export function useDraftAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      timer = null;
      const s = useLabStore.getState();
      const draft: ProjectSnapshot = {
        id: s.projectId, name: s.projectName, architecture: s.architecture, components: s.components, files: s.files,
      };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage full or private mode */ }
    };
    const unsub = useLabStore.subscribe((s, p) => {
      if (s.files === p.files && s.components === p.components && s.architecture === p.architecture &&
          s.projectName === p.projectName && s.projectId === p.projectId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, 800);
    });
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, []);
}

export function useOnlineStatus() {
  useEffect(() => {
    const update = () => useLabStore.getState().setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
}