import { createClient } from "jsr:@supabase/supabase-js@2";
import { GameCtx } from "./engine.ts";
import { PlayerRow, RoomRow } from "./types.ts";

export function admin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function loadRoomByCode(code: string) {
  const db = admin();
  const { data: room } = await db.from("rooms").select("*").eq("code", code.toUpperCase()).single();
  if (!room) return null;
  const { data: players } = await db
    .from("players")
    .select("*")
    .eq("room_id", room.id)
    .neq("status", "left")
    .order("seat", { ascending: true });
  return { room: room as RoomRow, players: (players || []) as PlayerRow[] };
}

export async function loadCtx(code: string): Promise<GameCtx | null> {
  const found = await loadRoomByCode(code);
  if (!found) return null;
  const db = admin();
  const { data: hcRows } = await db
    .from("hole_cards")
    .select("player_id, cards")
    .eq("room_id", found.room.id);
  // deno-lint-ignore no-explicit-any
  const holeCards: Record<string, any> = {};
  for (const row of hcRows || []) holeCards[row.player_id as string] = row.cards;
  return { room: found.room, players: found.players, holeCards };
}

export async function saveCtx(ctx: GameCtx) {
  const db = admin();
  const { room, players, holeCards } = ctx;
  await db
    .from("rooms")
    .update({
      status: room.status,
      phase: room.phase,
      dealer_seat: room.dealer_seat,
      current_turn_seat: room.current_turn_seat,
      community_cards: room.community_cards,
      pot: room.pot,
      pots: room.pots,
      current_bet: room.current_bet,
      min_raise: room.min_raise,
      deck: room.deck,
      turn_expires_at: room.turn_expires_at,
      hand_number: room.hand_number,
      last_action: room.last_action,
      winners: room.winners,
      revealed_hands: room.revealed_hands,
      rabbit_cards: room.rabbit_cards,
      run_it_twice_enabled: room.run_it_twice_enabled,
      run_it_twice_boards: room.run_it_twice_boards,
      last_hand: room.last_hand,
      all_in_equity: room.all_in_equity,
    })
    .eq("id", room.id);

  for (const p of players) {
    await db
      .from("players")
      .update({
        chips: p.chips,
        current_bet: p.current_bet,
        total_bet_hand: p.total_bet_hand,
        status: p.status,
        has_acted: p.has_acted,
        auto_straddle: p.auto_straddle,
      })
      .eq("id", p.id);
  }

  const holeCardRows = Object.entries(holeCards).map(([pid, cards]) => ({
    player_id: pid,
    room_id: room.id,
    cards,
  }));
  if (holeCardRows.length) {
    await db.from("hole_cards").upsert(holeCardRows);
  }
}

export async function verifyPlayer(roomId: string, playerId: string, token: string) {
  if (!playerId || !token) return false;
  const db = admin();
  const { data } = await db
    .from("player_secrets")
    .select("player_id, token")
    .eq("player_id", playerId)
    .single();
  if (!data || data.token !== token) return false;
  const { data: player } = await db.from("players").select("id, room_id").eq("id", playerId).single();
  return !!player && player.room_id === roomId;
}

export function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function genToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
