import { ref, update, set, remove, onValue, onDisconnect } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { toKey, fromKey } from "@/lib/telemetry";
import type { Architecture, BenchComponent, CameraPose } from "@/store/useLabStore";

export interface RoomState { architecture: Architecture; components: BenchComponent[]; pins: Record<string, number>; }
export interface RoomMember { uid: string; name: string; }
export interface RoomSnapshot {
  name: string;
  ownerUid: string;
  state: RoomState | null;
  members: RoomMember[];
  camera: CameraPose | null;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeRoomCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
}

export async function createRoom(uid: string, name: string): Promise<string> {
  const id = makeRoomCode();
  await update(ref(rtdb), {
    [`rooms/${id}/owner_uid`]: uid,
    [`rooms/${id}/name`]: name,
    [`rooms/${id}/created_at`]: Date.now(),
  });
  return id;
}

export async function joinRoom(id: string, uid: string, name: string) {
  const memberRef = ref(rtdb, `rooms/${id}/members/${uid}`);
  try {
    await set(memberRef, { name, joined_at: Date.now() });
  } catch {
    throw new Error(`Room ${id} was not found`);
  }
  await onDisconnect(memberRef).remove();
}

export async function leaveRoom(id: string, uid: string) {
  await remove(ref(rtdb, `rooms/${id}/members/${uid}`));
}

export function publishRoomState(id: string, state: RoomState) {
  const pins: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.pins)) pins[toKey(k)] = v;
  const payload = JSON.parse(JSON.stringify({ ...state, pins, updated_at: Date.now() }));
  return set(ref(rtdb, `rooms/${id}/state`), payload);
}

export function publishCamera(id: string, pose: CameraPose) {
  return set(ref(rtdb, `rooms/${id}/camera`), pose).catch(console.error);
}

export function subscribeRoom(id: string, cb: (room: RoomSnapshot) => void, onError: (e: Error) => void) {
  return onValue(
    ref(rtdb, `rooms/${id}`),
    (snap) => {
      const v = snap.val() ?? {};
      const rawState = v.state;
      let state: RoomState | null = null;
      if (rawState) {
        const comps = rawState.components ?? [];
        const pins: Record<string, number> = {};
        for (const [k, val] of Object.entries((rawState.pins ?? {}) as Record<string, number>)) pins[fromKey(k)] = val;
        state = {
          architecture: rawState.architecture,
          components: (Array.isArray(comps) ? comps : Object.values(comps)) as BenchComponent[],
          pins,
        };
      }
      const members = Object.entries((v.members ?? {}) as Record<string, { name: string }>).map(([uid, m]) => ({
        uid, name: m.name,
      }));
      cb({ name: v.name ?? id, ownerUid: v.owner_uid ?? "", state, members, camera: v.camera ?? null });
    },
    onError
  );
}