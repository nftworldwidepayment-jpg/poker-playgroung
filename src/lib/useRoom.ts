"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabaseClient";
import { PlayerRow, RoomRow } from "./types";

// youId (if provided) is tracked as "present" in this room's realtime presence set,
// so every other tab watching the same room can tell who's actually connected right
// now vs. who just hasn't left their seat — purely informational (the 30s server-side
// turn timeout already keeps the game moving regardless of presence).
export function useRoom(code: string, youId?: string | null) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    const sb = supabaseBrowser();

    async function init() {
      const { data: roomData } = await sb
        .from("rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .single();
      if (cancelled) return;
      if (!roomData) {
        setLoading(false);
        return;
      }
      const roomRow = roomData as unknown as RoomRow;
      setRoom(roomRow);
      const roomId = roomRow.id;

      const { data: playerRows } = await sb
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .neq("status", "left")
        .order("seat", { ascending: true });
      if (cancelled) return;
      setPlayers((playerRows || []) as unknown as PlayerRow[]);
      setLoading(false);

      const channel = sb
        .channel(`room-${roomId}`, { config: { presence: { key: youId || crypto.randomUUID() } } })
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
          (payload) => setRoom(payload.new as unknown as RoomRow)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
          async () => {
            const { data } = await sb
              .from("players")
              .select("*")
              .eq("room_id", roomId)
              .neq("status", "left")
              .order("seat", { ascending: true });
            setPlayers((data || []) as unknown as PlayerRow[]);
          }
        )
        .on("presence", { event: "sync" }, () => {
          setConnectedIds(new Set(Object.keys(channel.presenceState())));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && youId) {
            await channel.track({ playerId: youId, online_at: new Date().toISOString() });
          }
        });

      return () => {
        sb.removeChannel(channel);
      };
    }

    const cleanupPromise = init();
    return () => {
      cancelled = true;
      cleanupPromise.then((fn) => fn && fn());
    };
  }, [code, youId]);

  return { room, players, loading, connectedIds };
}
