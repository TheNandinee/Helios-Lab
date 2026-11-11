"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLabStore } from "@/store/useLabStore";
import { createRoom, joinRoom, leaveRoom, publishRoomState, subscribeRoom, type RoomMember } from "@/lib/rooms";
import { stopSimulation } from "@/sim/controller";

export default function RoomPanel() {
  const s = useLabStore(
    useShallow((st) => ({
      user: st.user, role: st.role, room: st.room, followHost: st.followHost,
      setRoom: st.setRoom, setFollowHost: st.setFollowHost, setRemoteCamera: st.setRemoteCamera,
    }))
  );
  const [code, setCode] = useState("");
  const [roomTitle, setRoomTitle] = useState("Lab session");
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [status, setStatus] = useState("");
  const isStaff = s.role === "instructor" || s.role === "admin";
  const room = s.room;

  // Everyone in the room: listen for state, camera and members
  useEffect(() => {
    if (!room) return;
    return subscribeRoom(
      room.id,
      (r) => {
        setMembers(r.members);
        if (room.isHost) return;
        const st = useLabStore.getState();
        if (r.camera) st.setRemoteCamera(r.camera);
        if (st.followHost && r.state) {
          st.applyRemoteBench(r.state.architecture, r.state.components);
          st.setPins(r.state.pins);
        }
      },
      (e) => setStatus(e.message)
    );
  }, [room]);

  // Host: broadcast bench + pins (throttled to 5 updates/s)
  useEffect(() => {
    if (!room?.isHost) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const push = () => {
      timer = null;
      const st = useLabStore.getState();
      publishRoomState(room.id, { architecture: st.architecture, components: st.components, pins: st.pinStates }).catch(console.error);
    };
    push();
    const unsub = useLabStore.subscribe((st, prev) => {
      if (st.components === prev.components && st.architecture === prev.architecture && st.pinStates === prev.pinStates) return;
      if (!timer) timer = setTimeout(push, 200);
    });
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, [room]);

  if (!s.user) return null;
  const user = s.user;

  async function handleCreate() {
    setStatus("Creating…");
    try {
      const id = await createRoom(user.uid, roomTitle);
      await joinRoom(id, user.uid, user.email ?? "host");
      s.setRoom({ id, isHost: true });
      setStatus("");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not create room");
    }
  }

  async function handleJoin() {
    const id = code.trim().toUpperCase();
    if (id.length !== 6) { setStatus("Room codes have 6 characters"); return; }
    setStatus("Joining…");
    try {
      await joinRoom(id, user.uid, user.email ?? "student");
      stopSimulation();
      s.setFollowHost(true);
      s.setRoom({ id, isHost: false });
      setStatus("");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not join");
    }
  }

  async function handleLeave() {
    if (room) await leaveRoom(room.id, user.uid).catch(console.error);
    s.setRoom(null);
    s.setRemoteCamera(null);
    setMembers([]);
  }

  return (
    <div className="glass space-y-2 rounded-xl p-2 text-xs">
      {!room ? (
        <>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Room code"
              className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 uppercase"
            />
            <button onClick={handleJoin} className="rounded bg-slate-800 px-3 py-1 hover:bg-slate-700">Join room</button>
          </div>
          {isStaff && (
            <div className="flex gap-2">
              <input
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
              <button onClick={handleCreate} className="rounded bg-sky-500 px-3 py-1 font-semibold text-slate-950">Create room</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sky-300">Room {room.id}</span>
            <span className="text-slate-400">{room.isHost ? "you are hosting" : "joined"}</span>
            <button onClick={handleLeave} className="ml-auto rounded bg-red-500/20 px-2 py-0.5 text-red-300">Leave</button>
          </div>
          {!room.isHost && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={s.followHost}
                onChange={(e) => { s.setFollowHost(e.target.checked); if (e.target.checked) stopSimulation(); }}
              />
              Follow instructor bench + camera
            </label>
          )}
          <div className="flex flex-wrap gap-1">
            {members.map((m) => (
              <span key={m.uid} className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{m.name}</span>
            ))}
          </div>
        </>
      )}
      {status && <p className="text-amber-300">{status}</p>}
    </div>
  );
}