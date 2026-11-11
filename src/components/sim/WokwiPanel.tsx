"use client";

import { useEffect, useRef, useState } from "react";

const WOKWI_ORIGIN = "https://wokwi.com";

export default function WokwiPanel() {
  const projectId = process.env.NEXT_PUBLIC_WOKWI_PROJECT_ID;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== WOKWI_ORIGIN) return; // security: ignore other origins
      const line = `${new Date().toLocaleTimeString()}  ${JSON.stringify(e.data).slice(0, 140)}`;
      setLog((l) => [line, ...l].slice(0, 25));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function sendPing() {
    iframeRef.current?.contentWindow?.postMessage({ source: "helios-lab", type: "ping" }, WOKWI_ORIGIN);
  }

  if (!projectId) {
    return (
      <div className="glass rounded-xl p-4 text-sm text-slate-400">
        Set NEXT_PUBLIC_WOKWI_PROJECT_ID in .env.local to load the simulator.
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-3 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Wokwi Simulator</h2>
        <button onClick={sendPing} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">
          Send ping
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={`https://wokwi.com/projects/${projectId}`}
        className="w-full flex-1 min-h-[300px] rounded-lg border border-slate-700 bg-white"
        allow="fullscreen; serial"
      />
      <div className="h-24 overflow-auto rounded bg-black/60 p-2 font-mono text-[10px] text-green-400">
        {log.length === 0 ? "Waiting for messages from Wokwi…" : log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}