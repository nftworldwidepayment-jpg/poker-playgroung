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

// Campos de jogador que o motor pode alterar — a lista que saveCtx compara e
// escreve. Manter em sincronia com o update em saveCtx.
const PLAYER_SAVE_FIELDS = [
  "chips",
  "current_bet",
  "total_bet_hand",
  "status",
  "has_acted",
  "auto_straddle",
  "wants_sit_out",
  "last_action_at",
  "consecutive_timeouts",
] as const;

// Snapshot dos jogadores tal como saíram da base de dados, para saveCtx só
// escrever as linhas que o motor realmente alterou. Antes disto, cada ação
// reescrevia TODOS os jogadores sequencialmente (até 9 round-trips), e cada
// escrita disparava um evento realtime para todos os clientes — a principal
// causa da lentidão percebida do jogo.
const ctxSnapshots = new WeakMap<GameCtx, Map<string, string>>();
const ctxHoleSnapshots = new WeakMap<GameCtx, string>();

function playerFingerprint(p: PlayerRow): string {
  return JSON.stringify(PLAYER_SAVE_FIELDS.map((f) => p[f]));
}

export async function loadCtx(code: string): Promise<GameCtx | null> {
  const db = admin();
  const { data: room } = await db.from("rooms").select("*").eq("code", code.toUpperCase()).single();
  if (!room) return null;
  // players e hole_cards em paralelo — só dependem do id da sala
  const [{ data: players }, { data: hcRows }] = await Promise.all([
    db
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .neq("status", "left")
      .order("seat", { ascending: true }),
    db.from("hole_cards").select("player_id, cards").eq("room_id", room.id),
  ]);
  // deno-lint-ignore no-explicit-any
  const holeCards: Record<string, any> = {};
  for (const row of hcRows || []) holeCards[row.player_id as string] = row.cards;
  const ctx: GameCtx = {
    room: room as RoomRow,
    players: (players || []) as PlayerRow[],
    holeCards,
  };
  ctxSnapshots.set(ctx, new Map(ctx.players.map((p) => [p.id, playerFingerprint(p)])));
  ctxHoleSnapshots.set(ctx, JSON.stringify(holeCards));
  return ctx;
}

export async function saveCtx(ctx: GameCtx) {
  const db = admin();
  const { room, players, holeCards } = ctx;

  // 1) Jogadores primeiro, todos em paralelo, e só os que mudaram — a linha
  //    da sala fica para o fim, funcionando como o "commit" que os clientes
  //    usam para reagir à mudança de vez (assim nunca veem a vez nova antes
  //    de os stacks estarem atualizados).
  const snapshots = ctxSnapshots.get(ctx);
  const dirty = players.filter((p) => !snapshots || snapshots.get(p.id) !== playerFingerprint(p));
  const playerWrites = dirty.map((p) =>
    db
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
      .eq("id", p.id)
  );

  // hole_cards só mudam quando uma mão nova é dada (startHand) — em todas as
  // outras ações o upsert era um round-trip desperdiçado em cada jogada.
  // Detetado por fingerprint (e não por fase, que falharia quando toda a
  // gente fica all-in logo nas blinds e a mão salta o preflop inteiro).
  const holeCardRows = Object.entries(holeCards).map(([pid, cards]) => ({
    player_id: pid,
    room_id: room.id,
    cards,
  }));
  const holeChanged = ctxHoleSnapshots.get(ctx) !== JSON.stringify(holeCards);
  const holeWrite = holeChanged && holeCardRows.length ? [db.from("hole_cards").upsert(holeCardRows)] : [];

  await Promise.all([...playerWrites, ...holeWrite]);

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
  const verifiedRoomId = await verifyToken(playerId, token);
  return verifiedRoomId === roomId;
}

// Variante para os ops quentes (action/start): devolve o room_id do jogador se
// o token bater certo, para poder correr EM PARALELO com o loadCtx (que é quem
// sabe o room_id real) em vez de à frente dele — e as suas duas queries também
// correm em paralelo entre si. Poupa 2 round-trips sequenciais em cada jogada.
export async function verifyToken(playerId: string, token: string): Promise<string | null> {
  if (!playerId || !token) return null;
  const db = admin();
  const [{ data: secret }, { data: player }] = await Promise.all([
    db.from("player_secrets").select("token").eq("player_id", playerId).single(),
    db.from("players").select("room_id").eq("id", playerId).single(),
  ]);
  if (!secret || secret.token !== token) return null;
  return player?.room_id ?? null;
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
