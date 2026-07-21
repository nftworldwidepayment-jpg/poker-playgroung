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
      // torneio: as blinds sobem por nível, por isso small/big blind deixam de
      // ser imutáveis pós-create e têm de ser persistidas a cada mão
      small_blind: room.small_blind,
      big_blind: room.big_blind,
      blind_level: room.blind_level,
      tourney_started_at: room.tourney_started_at,
      base_small_blind: room.base_small_blind,
      base_big_blind: room.base_big_blind,
      finish_order: room.finish_order,
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
        wants_sit_out: p.wants_sit_out,
        last_action_at: p.last_action_at,
        consecutive_timeouts: p.consecutive_timeouts,
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

  // permanent server-side hand history — the client only keeps the last 5 hands locally.
  // onConflict makes this safe to call repeatedly (e.g. a "show hand" reveal after
  // showdown re-saves the same hand without inserting a duplicate row).
  if (room.phase === "showdown" && room.winners && room.winners.length > 0) {
    await db
      .from("hand_history")
      .upsert(
        {
          room_id: room.id,
          hand_number: room.hand_number,
          game_type: room.game_type,
          board: room.community_cards,
          winners: room.winners,
          revealed_hands: room.revealed_hands,
        },
        { onConflict: "room_id,hand_number" }
      );
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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Room passwords live in their own RLS-locked table (service-role only) instead of a
// plaintext column on `rooms` — `rooms` is publicly readable (anyone can see room state
// to play), and Realtime replicates whole rows to subscribers, so anything secret can
// never live there even hashed. Salted SHA-256 is adequate here: these aren't account
// credentials reused elsewhere, just a lightweight gate on top of the room code.
export async function setRoomPassword(db: ReturnType<typeof admin>, roomId: string, password: string) {
  const salt = crypto.randomUUID();
  const hash = await sha256Hex(salt + password);
  await db.from("room_passwords").upsert({ room_id: roomId, password_hash: hash, salt });
}

export async function checkRoomPassword(
  db: ReturnType<typeof admin>,
  roomId: string,
  attempt: string
): Promise<boolean> {
  const { data } = await db.from("room_passwords").select("password_hash, salt").eq("room_id", roomId).maybeSingle();
  if (!data) return true; // no password set — nothing to check
  const hash = await sha256Hex(data.salt + attempt);
  return hash === data.password_hash;
}
