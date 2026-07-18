import { admin, genCode, genToken, loadCtx, saveCtx, verifyPlayer } from "./db.ts";
import { applyAction, applyTimeout, canStartHand, showHand, startHand } from "./engine.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
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

    switch (op) {
      case "create": {
        const name = String(body.name || "Jogador").trim().slice(0, 20) || "Jogador";
        const smallBlind = Math.max(1, Number(body.smallBlind) || 10);
        const bigBlind = Math.max(smallBlind * 2, Number(body.bigBlind) || smallBlind * 2);
        const buyIn = Math.max(bigBlind * 10, Number(body.buyIn) || 1000);
        const gameType = body.gameType === "plo4" ? "plo4" : "nlhe";
        const runItTwiceEnabled = !!body.runItTwiceEnabled;
        const maxPlayers = [2, 6, 9].includes(Number(body.maxPlayers)) ? Number(body.maxPlayers) : 9;
        const ante = Math.max(0, Math.min(Number(body.ante) || 0, bigBlind * 5));
        const turnSeconds = [15, 30, 60].includes(Number(body.turnSeconds)) ? Number(body.turnSeconds) : 30;
        const allowStraddle = body.allowStraddle !== false;
        const joinPassword = String(body.joinPassword || "").trim().slice(0, 30) || null;
        const tableName = String(body.tableName || "").trim().slice(0, 30) || null;
        const avatarKey = String(body.avatarKey || "").trim().slice(0, 40) || null;

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
            max_players: maxPlayers,
            ante,
            turn_seconds: turnSeconds,
            allow_straddle: allowStraddle,
            join_password: joinPassword,
            table_name: tableName,
          })
          .select()
          .single();
        if (error || !room) return json({ error: "Falha ao criar sala" }, 500);

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
        const name = String(body.name || "Jogador").trim().slice(0, 20) || "Jogador";
        const password = String(body.password || "");
        const avatarKey = String(body.avatarKey || "").trim().slice(0, 40) || null;
        const db = admin();
        const { data: room } = await db.from("rooms").select("*").eq("code", code).single();
        if (!room) return json({ error: "Sala não encontrada" }, 404);

        if (room.join_password && room.join_password !== password) {
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

        const { data: player, error } = await db
          .from("players")
          .insert({ room_id: room.id, seat, name, chips: 1000, is_host: false, avatar_key: avatarKey })
          .select()
          .single();
        if (error || !player) return json({ error: "Falha ao entrar" }, 500);

        const token = genToken();
        await db.from("player_secrets").insert({ player_id: player.id, token });
        return json({ code: room.code, playerId: player.id, token });
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

        await db.from("players").update({ status: "left" }).eq("id", targetId);
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

      default:
        return json({ error: "Operação desconhecida" }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
