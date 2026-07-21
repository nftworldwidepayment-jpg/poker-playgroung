import { admin, checkRoomPassword, genCode, genToken, loadCtx, saveCtx, setRoomPassword, verifyPlayer } from "./db.ts";
import { applyAction, applyTimeout, canStartHand, showHand, startHand } from "./engine.ts";
import { decideBotAction } from "./bot.ts";

// Only this app's own origins are allowed to make browser CORS requests — an arbitrary
// third-party site embedding this endpoint could otherwise ride a visitor's browser to
// act on their behalf. Preview deployments get a fresh random subdomain per push, so we
// match the whole *.vercel.app pattern for this project rather than a fixed list.
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === "http://localhost:3000") return true;
  return /^https:\/\/poker-playgroung(-[a-z0-9-]+)?\.vercel\.app$/.test(origin);
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : "https://poker-playgroung-nftworldwidepayment-1767s-projects.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req.headers.get("origin"));
  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const url = new URL(req.url);
    let op = url.searchParams.get("op") || "";
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      body = await req.json().catch(() => ({}));
      if (!op) op = (body.op as string) || "";
    } else {
      body = Object.fromEntries(url.searchParams.entries());
    }

    const AVATAR_KEYS = ["steampunk-man", "old-man", "wolf", "raven"];
    function randomAvatarKey(): string {
      return AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)];
    }

    switch (op) {
      case "create": {
        const name = String(body.name || "Jogador").trim().replace(/\s+/g, " ").slice(0, 20) || "Jogador";
        const smallBlind = Math.max(1, Number(body.smallBlind) || 10);
        const bigBlind = Math.max(smallBlind * 2, Number(body.bigBlind) || smallBlind * 2);
        const buyIn = Math.max(bigBlind * 10, Number(body.buyIn) || 1000);
        const gameType = body.gameType === "plo4" ? "plo4" : "nlhe";
        const runItTwiceEnabled = !!body.runItTwiceEnabled;
        const rabbitHuntEnabled = body.rabbitHuntEnabled !== false;
        const maxPlayers = [2, 6, 9].includes(Number(body.maxPlayers)) ? Number(body.maxPlayers) : 9;
        const ante = Math.max(0, Math.min(Number(body.ante) || 0, bigBlind * 5));
        const turnSeconds = [15, 30, 60].includes(Number(body.turnSeconds)) ? Number(body.turnSeconds) : 30;
        const allowStraddle = body.allowStraddle !== false;
        const joinPassword = String(body.joinPassword || "").trim().slice(0, 30) || null;
        const tableName = String(body.tableName || "").trim().slice(0, 30) || null;
        const avatarKey = String(body.avatarKey || "").trim().slice(0, 40) || randomAvatarKey();
        const tourneyEnabled = !!body.tourneyMode;
        const levelMinutes = [5, 8, 10, 15, 20].includes(Number(body.levelMinutes)) ? Number(body.levelMinutes) : 10;

        const db = admin();
        let code = genCode();
        for (let i = 0; i < 5; i++) {
          const { data } = await db.from("rooms").select("id").eq("code", code).maybeSingle();
          if (!data) break;
          code = genCode();
        }
        const { data: room, error } = await db
          .from("rooms")
          .insert({
            code,
            small_blind: smallBlind,
            big_blind: bigBlind,
            status: "waiting",
            phase: "waiting",
            game_type: gameType,
            run_it_twice_enabled: runItTwiceEnabled,
            rabbit_hunt_enabled: rabbitHuntEnabled,
            max_players: maxPlayers,
            ante,
            turn_seconds: turnSeconds,
            allow_straddle: allowStraddle,
            is_private: !!joinPassword,
            table_name: tableName,
            buy_in: buyIn,
            tourney_enabled: tourneyEnabled,
            level_minutes: levelMinutes,
          })
          .select()
          .single();
        if (error || !room) return json({ error: "Falha ao criar sala" }, 500);
        if (joinPassword) await setRoomPassword(db, room.id, joinPassword);

        const { data: player, error: pErr } = await db
          .from("players")
          .insert({ room_id: room.id, seat: 0, name, chips: buyIn, is_host: true, avatar_key: avatarKey })
          .select()
          .single();
        if (pErr || !player) return json({ error: "Falha ao criar jogador" }, 500);

        const token = genToken();
        await db.from("player_secrets").insert({ player_id: player.id, token });
        return json({ code: room.code, playerId: player.id, token });
      }

      case "join": {
        const code = String(body.code || "").trim().toUpperCase();
        const name = String(body.name || "Jogador").trim().replace(/\s+/g, " ").slice(0, 20) || "Jogador";
        const password = String(body.password || "");
        const avatarKey = String(body.avatarKey || "").trim().slice(0, 40) || randomAvatarKey();
        const db = admin();
        const { data: room } = await db.from("rooms").select("*").eq("code", code).single();
        if (!room) return json({ error: "Sala não encontrada" }, 404);

        if (room.is_private && !(await checkRoomPassword(db, room.id, password))) {
          return json({ error: "Palavra-passe incorreta", requiresPassword: true }, 403);
        }

        const { data: players } = await db
          .from("players")
          .select("*")
          .eq("room_id", room.id)
          .neq("status", "left");

        if (room.status === "playing") {
          return json({ error: "O jogo já começou. Espera pela próxima ronda." }, 400);
        }
        if ((players || []).length >= room.max_players) return json({ error: "Sala cheia" }, 400);

        const usedSeats = new Set((players || []).map((p) => p.seat));
        let seat = 0;
        while (usedSeats.has(seat)) seat++;

        // buy_in da sala em vez de 1000 fixo — antes disto, quem entrava numa
        // mesa criada com buy-in diferente recebia um stack desigual ao do host
        const { data: player, error } = await db
          .from("players")
          .insert({ room_id: room.id, seat, name, chips: room.buy_in || 1000, is_host: false, avatar_key: avatarKey })
          .select()
          .single();
        if (error || !player) return json({ error: "Falha ao entrar" }, 500);

        const token = genToken();
        await db.from("player_secrets").insert({ player_id: player.id, token });
        return json({ code: room.code, playerId: player.id, token });
      }

      case "add_bot": {
        const { playerId, token, difficulty } = body as {
          playerId: string;
          token: string;
          difficulty?: string;
        };
        const botDifficulty = ["easy", "medium", "hard"].includes(String(difficulty)) ? String(difficulty) : "medium";
        const db = admin();
        const { data: requester } = await db.from("players").select("room_id, is_host").eq("id", playerId).single();
        if (!requester) return json({ error: "Jogador não encontrado" }, 404);
        const ok = await verifyPlayer(requester.room_id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        if (!requester.is_host) return json({ error: "Só o anfitrião pode adicionar bots" }, 403);

        const { data: room } = await db.from("rooms").select("*").eq("id", requester.room_id).single();
        if (!room) return json({ error: "Sala não encontrada" }, 404);
        if (room.status !== "waiting") return json({ error: "Só podes adicionar bots antes de começar" }, 400);

        const { data: players } = await db.from("players").select("*").eq("room_id", room.id).neq("status", "left");
        if ((players || []).length >= room.max_players) return json({ error: "Sala cheia" }, 400);

        const usedSeats = new Set((players || []).map((p) => p.seat));
        let seat = 0;
        while (usedSeats.has(seat)) seat++;

        const label = { easy: "Fácil", medium: "Médio", hard: "Difícil" }[botDifficulty as "easy" | "medium" | "hard"];
        // flavour nicknames matching each profile's actual play style in bot.ts
        // (easy = loose-passive calling station, medium = solid TAG regular,
        // hard = aggressive/balanced professional) — falls back to a numbered
        // name once a table's nicknames for that difficulty run out.
        const NICKNAMES: Record<string, string[]> = {
          easy: ["Chamador", "Curioso", "Otimista", "Sortudo"],
          medium: ["Regular", "Sólido", "Metódico", "Disciplinado"],
          hard: ["Predador", "Tubarão", "Maníaco", "Impiedoso"],
        };
        const usedNames = new Set((players || []).filter((p) => p.is_bot).map((p) => p.name));
        const pool = NICKNAMES[botDifficulty as "easy" | "medium" | "hard"];
        const available = pool.filter((n) => !usedNames.has(`Bot ${label} "${n}"`));
        const nickname = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
        const botCount = (players || []).filter((p) => p.is_bot).length;
        const name = nickname ? `Bot ${label} "${nickname}"` : `Bot ${label} ${botCount + 1}`;

        const { data: bot, error } = await db
          .from("players")
          .insert({
            room_id: room.id,
            seat,
            name,
            chips: room.buy_in || 1000,
            is_host: false,
            avatar_key: randomAvatarKey(),
            is_bot: true,
            bot_difficulty: botDifficulty,
          })
          .select()
          .single();
        if (error || !bot) return json({ error: "Falha ao adicionar bot" }, 500);
        return json({ ok: true, playerId: bot.id });
      }

      case "set_bot_difficulty": {
        const { playerId, token, targetId, difficulty } = body as {
          playerId: string;
          token: string;
          targetId: string;
          difficulty: string;
        };
        if (!["easy", "medium", "hard"].includes(difficulty)) return json({ error: "Dificuldade inválida" }, 400);
        const db = admin();
        const { data: requester } = await db.from("players").select("room_id, is_host").eq("id", playerId).single();
        if (!requester) return json({ error: "Jogador não encontrado" }, 404);
        const ok = await verifyPlayer(requester.room_id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        if (!requester.is_host) return json({ error: "Só o anfitrião pode alterar a dificuldade" }, 403);
        const { data: target } = await db.from("players").select("room_id, is_bot").eq("id", targetId).single();
        if (!target || target.room_id !== requester.room_id || !target.is_bot) {
          return json({ error: "Bot não encontrado" }, 404);
        }
        await db.from("players").update({ bot_difficulty: difficulty }).eq("id", targetId);
        return json({ ok: true });
      }

      case "bot_tick": {
        // Public op (no auth) — same trust model as "timeout": any connected client
        // may trigger it, but it only ever does something if the seat to act really
        // is a bot's, and the decision itself runs entirely server-side, so a client
        // triggering this early/often can't gain any information or edge.
        const code = String(body.code || "").trim().toUpperCase();
        // Pré-verificação leve: os clientes fazem nudge disto com frequência e
        // na maioria das vezes não há nada para fazer — carregar o contexto
        // completo (sala + jogadores + hole cards) em cada nudge era carga
        // inútil constante na base de dados.
        const db0 = admin();
        const { data: lite } = await db0
          .from("rooms")
          .select("id, status, current_turn_seat")
          .eq("code", code)
          .single();
        if (!lite) return json({ error: "Sala não encontrada" }, 404);
        if (lite.status !== "playing" || lite.current_turn_seat == null) return json({ ok: false });
        const { data: seatP } = await db0
          .from("players")
          .select("is_bot, status")
          .eq("room_id", lite.id)
          .eq("seat", lite.current_turn_seat)
          .neq("status", "left")
          .maybeSingle();
        if (!seatP?.is_bot || seatP.status !== "active") return json({ ok: false });

        const ctx = await loadCtx(code);
        if (!ctx) return json({ error: "Sala não encontrada" }, 404);
        if (ctx.room.status !== "playing") return json({ ok: false });
        const bot = ctx.players.find((p) => p.seat === ctx.room.current_turn_seat);
        if (!bot || !bot.is_bot || bot.status !== "active") return json({ ok: false });

        const decision = decideBotAction(ctx.room, ctx.players, bot, ctx.holeCards[bot.id] || []);
        try {
          applyAction(ctx, bot.id, decision.action, decision.amount);
        } catch {
          // The chosen action turned out to be illegal (e.g. a PLO4 pot-cap edge
          // case clamped the raise below a legal size) — fall back to the always-
          // legal default instead of leaving the bot stuck on its turn forever.
          try {
            applyAction(ctx, bot.id, bot.current_bet === ctx.room.current_bet ? "check" : "call");
          } catch {
            return json({ ok: false });
          }
        }
        await saveCtx(ctx);
        return json({ ok: true });
      }

      case "start": {
        const code = String(body.code || "").trim().toUpperCase();
        const { playerId, token } = body as { playerId: string; token: string };
        const ctx = await loadCtx(code);
        if (!ctx) return json({ error: "Sala não encontrada" }, 404);
        const ok = await verifyPlayer(ctx.room.id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        const requester = ctx.players.find((p) => p.id === playerId);
        if (!requester?.is_host) return json({ error: "Só o anfitrião pode iniciar" }, 403);
        if (!canStartHand(ctx.players)) {
          return json({ error: "Precisas de pelo menos 2 jogadores com fichas" }, 400);
        }
        try {
          startHand(ctx);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Erro ao iniciar mão" }, 400);
        }
        await saveCtx(ctx);
        return json({ ok: true });
      }

      case "action": {
        const code = String(body.code || "").trim().toUpperCase();
        const { playerId, token, action, amount } = body as {
          playerId: string;
          token: string;
          action: string;
          amount?: number;
        };
        if (!["fold", "check", "call", "raise", "all_in"].includes(action)) {
          return json({ error: "Ação inválida" }, 400);
        }
        const ctx = await loadCtx(code);
        if (!ctx) return json({ error: "Sala não encontrada" }, 404);
        const ok = await verifyPlayer(ctx.room.id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        if (ctx.room.status === "paused") return json({ error: "A mesa está em pausa" }, 400);
        const actor = ctx.players.find((p) => p.id === playerId);
        // Simple anti-spam guard: reject a second action from the same player within
        // 300ms of the last one (accidental double-tap / a client retry racing itself),
        // independent of the "is it your turn" check applyAction already does.
        if (actor?.last_action_at && Date.now() - new Date(actor.last_action_at).getTime() < 300) {
          return json({ error: "Demasiado rápido, espera um instante" }, 429);
        }
        try {
          // deno-lint-ignore no-explicit-any
          applyAction(ctx, playerId, action as any, amount);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Ação inválida" }, 400);
        }
        if (actor) actor.last_action_at = new Date().toISOString();
        await saveCtx(ctx);
        return json({ ok: true });
      }

      case "timeout": {
        const code = String(body.code || "").trim().toUpperCase();
        // Pré-verificação leve pelo mesmo motivo do bot_tick: cada cliente
        // chama isto a cada ~1.2s e quase sempre o prazo ainda não expirou.
        const db0 = admin();
        const { data: lite } = await db0
          .from("rooms")
          .select("status, turn_expires_at")
          .eq("code", code)
          .single();
        if (!lite) return json({ error: "Sala não encontrada" }, 404);
        if (lite.status === "paused") return json({ ok: false });
        if (!lite.turn_expires_at || new Date(lite.turn_expires_at).getTime() > Date.now()) {
          return json({ ok: false });
        }

        const ctx = await loadCtx(code);
        if (!ctx) return json({ error: "Sala não encontrada" }, 404);
        if (ctx.room.status === "paused") return json({ ok: false });
        if (!ctx.room.turn_expires_at || new Date(ctx.room.turn_expires_at).getTime() > Date.now()) {
          return json({ ok: false });
        }
        try {
          applyTimeout(ctx);
        } catch {
          return json({ ok: false });
        }
        await saveCtx(ctx);
        return json({ ok: true });
      }

      case "toggle_straddle": {
        const { playerId, token, enabled } = body as { playerId: string; token: string; enabled: boolean };
        const db = admin();
        const { data: player } = await db.from("players").select("room_id").eq("id", playerId).single();
        if (!player) return json({ error: "Jogador não encontrado" }, 404);
        const ok = await verifyPlayer(player.room_id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        await db.from("players").update({ auto_straddle: !!enabled }).eq("id", playerId);
        return json({ ok: true });
      }

      case "toggle_sit_out": {
        const { playerId, token, enabled } = body as { playerId: string; token: string; enabled: boolean };
        const db = admin();
        const { data: player } = await db.from("players").select("room_id").eq("id", playerId).single();
        if (!player) return json({ error: "Jogador não encontrado" }, 404);
        const ok = await verifyPlayer(player.room_id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        // Only affects the NEXT hand's dealing — doesn't touch the player's status
        // mid-hand, so it never forces a fold or interrupts a hand in progress.
        await db.from("players").update({ wants_sit_out: !!enabled }).eq("id", playerId);
        return json({ ok: true });
      }

      case "toggle_run_it_twice": {
        const code = String(body.code || "").trim().toUpperCase();
        const { playerId, token, enabled } = body as { playerId: string; token: string; enabled: boolean };
        const db = admin();
        const { data: room } = await db.from("rooms").select("id").eq("code", code).single();
        if (!room) return json({ error: "Sala não encontrada" }, 404);
        const ok = await verifyPlayer(room.id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        const { data: player } = await db.from("players").select("is_host").eq("id", playerId).single();
        if (!player?.is_host) return json({ error: "Só o anfitrião pode alterar isto" }, 403);
        await db.from("rooms").update({ run_it_twice_enabled: !!enabled }).eq("id", room.id);
        return json({ ok: true });
      }

      case "toggle_rabbit_hunt": {
        const code = String(body.code || "").trim().toUpperCase();
        const { playerId, token, enabled } = body as { playerId: string; token: string; enabled: boolean };
        const db = admin();
        const { data: room } = await db.from("rooms").select("id").eq("code", code).single();
        if (!room) return json({ error: "Sala não encontrada" }, 404);
        const ok = await verifyPlayer(room.id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        const { data: player } = await db.from("players").select("is_host").eq("id", playerId).single();
        if (!player?.is_host) return json({ error: "Só o anfitrião pode alterar isto" }, 403);
        await db.from("rooms").update({ rabbit_hunt_enabled: !!enabled }).eq("id", room.id);
        return json({ ok: true });
      }

      case "toggle_pause": {
        const code = String(body.code || "").trim().toUpperCase();
        const { playerId, token, paused } = body as { playerId: string; token: string; paused: boolean };
        const db = admin();
        const { data: room } = await db.from("rooms").select("id, status, turn_expires_at, paused_at").eq("code", code).single();
        if (!room) return json({ error: "Sala não encontrada" }, 404);
        const ok = await verifyPlayer(room.id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        const { data: player } = await db.from("players").select("is_host").eq("id", playerId).single();
        if (!player?.is_host) return json({ error: "Só o anfitrião pode pausar a mesa" }, 403);

        if (paused) {
          if (room.status !== "playing") return json({ error: "Só podes pausar durante o jogo" }, 400);
          await db.from("rooms").update({ status: "paused", paused_at: new Date().toISOString() }).eq("id", room.id);
        } else {
          if (room.status !== "paused") return json({ ok: true });
          // extend the current turn's deadline by exactly however long the table was
          // paused, so nobody gets auto-folded for time that was frozen
          let newExpiry: string | null = null;
          if (room.turn_expires_at && room.paused_at) {
            const pausedMs = Date.now() - new Date(room.paused_at).getTime();
            newExpiry = new Date(new Date(room.turn_expires_at).getTime() + pausedMs).toISOString();
          }
          await db
            .from("rooms")
            .update({ status: "playing", paused_at: null, ...(newExpiry ? { turn_expires_at: newExpiry } : {}) })
            .eq("id", room.id);
        }
        return json({ ok: true });
      }

      case "kick_player": {
        const { playerId, token, targetId } = body as { playerId: string; token: string; targetId: string };
        const db = admin();
        const { data: requester } = await db.from("players").select("room_id, is_host").eq("id", playerId).single();
        if (!requester) return json({ error: "Jogador não encontrado" }, 404);
        const ok = await verifyPlayer(requester.room_id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        if (!requester.is_host) return json({ error: "Só o anfitrião pode remover jogadores" }, 403);
        if (targetId === playerId) return json({ error: "Não podes remover-te a ti próprio" }, 400);

        const { data: room } = await db.from("rooms").select("phase").eq("id", requester.room_id).single();
        // Only safe to remove someone between hands — mid-hand they may hold a live
        // bet, and nothing in the payout math accounts for a seat vanishing mid-street.
        if (room?.phase !== "waiting" && room?.phase !== "showdown") {
          return json({ error: "Só podes remover jogadores entre mãos" }, 400);
        }
        const { data: target } = await db.from("players").select("room_id").eq("id", targetId).single();
        if (!target || target.room_id !== requester.room_id) return json({ error: "Jogador não encontrado" }, 404);

        await db.from("players").update({ status: "left", left_at: new Date().toISOString() }).eq("id", targetId);
        return json({ ok: true });
      }

      case "show_hand": {
        const code = String(body.code || "").trim().toUpperCase();
        const { playerId, token } = body as { playerId: string; token: string };
        const ctx = await loadCtx(code);
        if (!ctx) return json({ error: "Sala não encontrada" }, 404);
        const ok = await verifyPlayer(ctx.room.id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        try {
          showHand(ctx, playerId);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Não é possível mostrar a mão" }, 400);
        }
        await saveCtx(ctx);
        return json({ ok: true });
      }

      case "hand": {
        const code = String(body.code || "").trim().toUpperCase();
        const { playerId, token } = body as { playerId: string; token: string };
        const db = admin();
        const { data: room } = await db.from("rooms").select("id").eq("code", code).single();
        if (!room) return json({ error: "Sala não encontrada" }, 404);
        const ok = await verifyPlayer(room.id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        const { data } = await db
          .from("hole_cards")
          .select("cards")
          .eq("player_id", playerId)
          .eq("room_id", room.id)
          .maybeSingle();
        return json({ cards: data?.cards || [] });
      }

      case "hand_history": {
        const code = String(body.code || "").trim().toUpperCase();
        const limit = Math.min(50, Math.max(1, Number(body.limit) || 20));
        const db = admin();
        const { data: room } = await db.from("rooms").select("id").eq("code", code).single();
        if (!room) return json({ error: "Sala não encontrada" }, 404);
        const { data } = await db
          .from("hand_history")
          .select("hand_number, game_type, board, winners, revealed_hands, created_at")
          .eq("room_id", room.id)
          .order("hand_number", { ascending: false })
          .limit(limit);
        return json({ hands: data || [] });
      }

      case "bug_report": {
        const message = String(body.message || "").trim().slice(0, 1000);
        if (!message) return json({ error: "Escreve uma descrição do problema" }, 400);
        const roomCode = String(body.code || "").trim().toUpperCase().slice(0, 10) || null;
        const playerName = String(body.name || "").trim().slice(0, 20) || null;
        const db = admin();
        await db.from("bug_reports").insert({ room_code: roomCode, player_name: playerName, message });
        return json({ ok: true });
      }

      case "export_my_data": {
        const { playerId, token } = body as { playerId: string; token: string };
        const db = admin();
        const { data: player } = await db.from("players").select("*").eq("id", playerId).maybeSingle();
        if (!player) return json({ error: "Jogador não encontrado" }, 404);
        const ok = await verifyPlayer(player.room_id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        const { data: holeCards } = await db.from("hole_cards").select("cards").eq("player_id", playerId).maybeSingle();
        // GDPR-style self-export: everything this app stores that's tied to this player id
        return json({ player, holeCards: holeCards?.cards || null });
      }

      case "delete_my_data": {
        const { playerId, token } = body as { playerId: string; token: string };
        const db = admin();
        const { data: player } = await db.from("players").select("room_id").eq("id", playerId).maybeSingle();
        if (!player) return json({ ok: true });
        const ok = await verifyPlayer(player.room_id, playerId, token);
        if (!ok) return json({ error: "Não autorizado" }, 401);
        // scrub personally-identifying fields but keep the row so seat numbering / pot
        // history for other players in the same hand stays consistent — this mirrors the
        // existing "kick" soft-delete rather than a hard delete that could orphan a hand mid-play
        await db
          .from("players")
          .update({ name: "Jogador removido", avatar_key: null, status: "left", left_at: new Date().toISOString() })
          .eq("id", playerId);
        await db.from("hole_cards").delete().eq("player_id", playerId);
        await db.from("player_secrets").delete().eq("player_id", playerId);
        return json({ ok: true });
      }

      case "admin_rooms": {
        // Gated by a secret set via `supabase secrets set ADMIN_KEY=...` — until that's
        // set, Deno.env.get returns undefined and no caller-supplied string can match it,
        // so this fails closed by default rather than being an accidentally-open panel.
        const adminKey = Deno.env.get("ADMIN_KEY");
        if (!adminKey || body.adminKey !== adminKey) return json({ error: "Não autorizado" }, 401);
        const db = admin();
        const { data: rooms } = await db
          .from("rooms")
          .select("code, status, phase, game_type, hand_number, created_at, max_players")
          .order("created_at", { ascending: false })
          .limit(200);
        const { count: playerCount } = await db.from("players").select("id", { count: "exact", head: true }).neq("status", "left");
        return json({ rooms: rooms || [], activePlayers: playerCount || 0 });
      }

      case "health": {
        // Cheap external uptime check: round-trips the DB so a broken connection
        // string/expired credentials show up as a failed health check, not just as
        // mysterious in-game errors later.
        const db = admin();
        const { error } = await db.from("rooms").select("id").limit(1);
        if (error) return json({ ok: false, db: false, error: error.message }, 503);
        return json({ ok: true, db: true, time: new Date().toISOString() });
      }

      default:
        return json({ error: "Operação desconhecida" }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
