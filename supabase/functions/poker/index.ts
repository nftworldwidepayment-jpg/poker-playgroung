import { admin, genCode, genToken, loadCtx, saveCtx, verifyPlayer } from "./db.ts";
import { applyAction, applyTimeout, canStartHand, startHand } from "./engine.ts";

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

        const db = admin();
        let code = genCode();
        for (let i = 0; i < 5; i++) {
          const { data } = await db.from("rooms").select("id").eq("code", code).maybeSingle();
          if (!data) break;
          code = genCode();
        }
        const { data: room, error } = await db
          .from("rooms")
          .insert({ code, small_blind: smallBlind, big_blind: bigBlind, status: "waiting", phase: "waiting" })
          .select()
          .single();
        if (error || !room) return json({ error: "Falha ao criar sala" }, 500);

        const { data: player, error: pErr } = await db
          .from("players")
          .insert({ room_id: room.id, seat: 0, name, chips: buyIn, is_host: true })
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
        const db = admin();
        const { data: room } = await db.from("rooms").select("*").eq("code", code).single();
        if (!room) return json({ error: "Sala não encontrada" }, 404);

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
          .insert({ room_id: room.id, seat, name, chips: 1000, is_host: false })
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
        try {
          // deno-lint-ignore no-explicit-any
          applyAction(ctx, playerId, action as any, amount);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Ação inválida" }, 400);
        }
        await saveCtx(ctx);
        return json({ ok: true });
      }

      case "timeout": {
        const code = String(body.code || "").trim().toUpperCase();
        const ctx = await loadCtx(code);
        if (!ctx) return json({ error: "Sala não encontrada" }, 404);
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
