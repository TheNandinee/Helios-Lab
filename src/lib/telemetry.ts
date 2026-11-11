import { ref, set, update, onValue } from "firebase/database";
import { rtdb } from "@/lib/firebase";

// Realtime DB keys cannot contain "." so P1.0 is stored as P1_0
export const toKey = (pin: string) => pin.replace(/\./g, "_");
export const fromKey = (key: string) => key.replace(/^P(\d)_(\d)$/, "P$1.$2");

export interface TelemetryPublisher {
  push(changes: Record<string, number>): void;
  stop(): void;
}

export function createTelemetryPublisher(opts: {
  streamId: string;
  ownerUid: string;
  projectId: string;
  intervalMs?: number;
  onAck?: (ms: number) => void;
}): TelemetryPublisher {
  const { streamId, ownerUid, projectId, intervalMs = 50, onAck } = opts;
  const streamRef = ref(rtdb, `telemetry_streams/${streamId}`);
  let pending: Record<string, number> = {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  // Reset the stream at the start of every run
  set(streamRef, { owner_uid: ownerUid, project_id: projectId, updated_at: Date.now() }).catch(console.error);

  const flush = () => {
    timer = null;
    const entries = Object.entries(pending);
    if (entries.length === 0) return;
    pending = {};
    const now = Date.now();
    const payload: Record<string, unknown> = { owner_uid: ownerUid, project_id: projectId, updated_at: now };
    for (const [pin, value] of entries) payload[`pins/${toKey(pin)}`] = { value, ts: now };
    const t0 = performance.now();
    update(streamRef, payload)
      .then(() => onAck?.(Math.round(performance.now() - t0)))
      .catch(console.error);
  };

  return {
    push(changes) {
      if (stopped) return;
      Object.assign(pending, changes);
      if (!timer) timer = setTimeout(flush, intervalMs);
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      flush();
    },
  };
}

export function subscribeTelemetry(streamId: string, cb: (pins: Record<string, number>) => void) {
  return onValue(ref(rtdb, `telemetry_streams/${streamId}`), (snap) => {
    const v = snap.val();
    const pins: Record<string, number> = {};
    for (const [k, p] of Object.entries((v?.pins ?? {}) as Record<string, { value: number }>)) {
      pins[fromKey(k)] = p.value;
    }
    cb(pins);
  });
}