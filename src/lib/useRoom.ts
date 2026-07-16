"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabaseClient";
import { PlayerRow, RoomRow } from "./types";

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);

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
        .channel(`room-${roomId}`)
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
        .subscribe();

      return () => {
        sb.removeChannel(channel);
      };
    }

    const cleanupPromise = init();
    return () => {
      cancelled = true;
      cleanupPromise.then((fn) => fn && fn());
    };
  }, [code]);

  return { room, players, loading };
}
