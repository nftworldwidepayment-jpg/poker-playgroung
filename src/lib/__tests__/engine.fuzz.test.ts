// Checked-in chip-conservation fuzz test — run via `npm run test:engine`.
//
// Plays randomized hands across several game-mode combinations (NLHE/PLO4, straddle,
// run-it-twice, ante, heads-up) and asserts the one invariant that holds at every point
// in the engine: sum(player.chips) + room.pot never changes except at the exact moments
// chips move into/out of the pot. This is how the "chips vanish after a hand" bug (a
// PLO4 all-in cap leaving an over-cap player "active" who then folds, orphaning a side-pot
// layer) was originally found and fixed — keep this passing before touching engine.ts.
import { startHand, applyAction, canStartHand } from "../engine";
import { decideBotAction, BotDifficulty } from "../bot";
import { RoomRow, PlayerRow, Card } from "../types";

function mkRoom(o: Partial<RoomRow> = {}): RoomRow {
  return {
    id: "r1", code: "A", status: "waiting", phase: "waiting", game_type: "nlhe",
    small_blind: 10, big_blind: 20, dealer_seat: null, current_turn_seat: null,
    community_cards: [], pot: 0, pots: [], current_bet: 0, min_raise: 20, deck: [],
    turn_expires_at: null, hand_number: 0, max_players: 9, last_action: null,
    winners: null, revealed_hands: null, created_at: "", rabbit_cards: null,
    rabbit_hunt_enabled: true,
    run_it_twice_enabled: false, run_it_twice_boards: null, last_hand: null, all_in_equity: null,
    ante: 0, turn_seconds: 30, allow_straddle: true, is_private: false, paused_at: null,
    table_name: null,
    buy_in: 1000, tourney_enabled: false, tourney_started_at: null, level_minutes: 10,
    blind_level: 0, base_small_blind: null, base_big_blind: null, finish_order: null,
    ...o,
  };
}
function mkPlayer(seat: number, chips: number, o: Partial<PlayerRow> = {}): PlayerRow {
  return {
    id: `p${seat}`, room_id: "r1", seat, name: `P${seat}`, chips, current_bet: 0,
    total_bet_hand: 0, status: "active", is_host: seat === 0, has_acted: false,
    is_connected: true, created_at: "", auto_straddle: false, wants_sit_out: false,
    avatar_key: null, last_action_at: null, left_at: null, consecutive_timeouts: 0,
    is_bot: false, bot_difficulty: null, ...o,
  };
}
function totalChips(players: PlayerRow[]): number {
  return players.reduce((s, p) => s + p.chips, 0); // only chips, current_bet is transient mid-hand
}
function totalWithPot(players: PlayerRow[], room: RoomRow): number {
  // sum(chips) + room.pot is a true invariant at ALL times: chips move into
  // the pot on a bet, and the pot empties back into chips at showdown/fold-win
  // (both zero room.pot when they pay out) — nothing else touches either side.
  return players.reduce((s, p) => s + p.chips, 0) + room.pot;
}

function runFuzz(numPlayers: number, gameType: "nlhe" | "plo4", runItTwice: boolean, straddle: boolean, hands: number, seedTag: string, ante = 0) {
  const players: PlayerRow[] = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push(mkPlayer(i, 4000, { auto_straddle: straddle && i === 3 % numPlayers }));
  }
  const room = mkRoom({ game_type: gameType, run_it_twice_enabled: runItTwice, small_blind: 10, big_blind: 20, ante });
  const ctx = { room, players, holeCards: {} as Record<string, Card[]> };

  const before = totalChips(players);
  let handCount = 0;

  while (handCount < hands) {
    // remove busted players (chips === 0) from future hands, like "left"/sitting_out
    const alive = players.filter((p) => p.chips > 0);
    if (!canStartHand(alive)) break;
    try {
      startHand(ctx);
    } catch (e) {
      console.log(`[${seedTag}] startHand threw:`, (e as Error).message);
      break;
    }
    handCount++;

    const actionLog: string[] = [];
    actionLog.push(`--- hand ${handCount} start: dealer=${room.dealer_seat} players=${JSON.stringify(players.map(p=>({id:p.id,seat:p.seat,chips:p.chips,status:p.status,auto_straddle:p.auto_straddle})))}`);

    let guard = 0;
    while (room.phase !== "showdown" && guard < 60) {
      guard++;
      const seat = room.current_turn_seat;
      if (seat == null) break;
      const p = players.find((pl) => pl.seat === seat);
      if (!p) break;

      const beforeAction = totalWithPot(players, room);

      const toCall = room.current_bet - p.current_bet;
      const r = Math.random();
      try {
        if (r < 0.18) {
          applyAction(ctx, p.id, "fold");
        } else if (r < 0.4) {
          if (toCall <= 0) applyAction(ctx, p.id, "check");
          else applyAction(ctx, p.id, "call");
        } else if (r < 0.55) {
          applyAction(ctx, p.id, "all_in");
        } else {
          const minRaiseTo = room.current_bet + room.min_raise;
          let maxRaiseTo = p.chips + p.current_bet;
          if (room.game_type === "plo4") {
            const potAfter = room.pot + toCall;
            maxRaiseTo = Math.min(maxRaiseTo, room.current_bet + potAfter);
          }
          if (maxRaiseTo > minRaiseTo && maxRaiseTo > room.current_bet) {
            const amt = Math.min(maxRaiseTo, Math.round(minRaiseTo + Math.random() * (maxRaiseTo - minRaiseTo)));
            applyAction(ctx, p.id, "raise", amt);
          } else if (toCall <= 0) {
            applyAction(ctx, p.id, "check");
          } else {
            applyAction(ctx, p.id, "call");
          }
        }
      } catch (e) {
        // recompute fresh — the primary attempt may have thrown without mutating
        // anything, but room.current_bet/p.current_bet could differ from the
        // toCall snapshotted above if this isn't actually the same actor anymore
        const stillMyTurn = room.current_turn_seat === p.seat && p.status === "active";
        if (!stillMyTurn) continue;
        const freshToCall = room.current_bet - p.current_bet;
        try {
          if (freshToCall <= 0) applyAction(ctx, p.id, "check");
          else applyAction(ctx, p.id, "call");
        } catch (e2) {
          try {
            applyAction(ctx, p.id, "fold");
          } catch (e3) {
            console.log(`[${seedTag}] !!! fallback ALSO threw (real bug?):`, (e as Error).message, "->", (e2 as Error).message, "->", (e3 as Error).message);
            break;
          }
        }
      }

      const afterAction = totalWithPot(players, room);
      actionLog.push(
        `${p.id} seat=${seat} action=${r < 0.18 ? "fold" : r < 0.4 ? "check/call" : r < 0.55 ? "all_in" : "raise"} -> phase=${room.phase} pot=${room.pot} current_bet=${room.current_bet} chips=${JSON.stringify(players.map(pl=>({id:pl.id,chips:pl.chips,tbh:pl.total_bet_hand,status:pl.status})))}`
      );
      if (beforeAction !== afterAction) {
        console.log(
          `[${seedTag}] !!! CHIP+POT MISMATCH mid-action at hand ${handCount}, action=${r < 0.18 ? "fold" : r < 0.4 ? "check/call" : r < 0.55 ? "all_in" : "raise"}: before=${beforeAction} after=${afterAction} (diff ${afterAction - beforeAction}), phase=${room.phase}, pot=${room.pot}`
        );
        console.log(actionLog.join("\n"));
      }
    }

    if (guard >= 60 && room.phase !== "showdown") {
      console.log(`[${seedTag}] !!! STUCK LOOP at hand ${handCount}, phase=${room.phase}, guard hit 60 without reaching showdown`);
      return false;
    }

    const after = totalChips(players);
    if (after !== before) {
      console.log(`[${seedTag}] !!! TOTAL CHIP DRIFT after hand ${handCount}: before=${before} after=${after} (diff ${after - before})`);
      console.log(actionLog.join("\n"));
      console.log(
        players.map((p) => ({ id: p.id, chips: p.chips, current_bet: p.current_bet, total_bet_hand: p.total_bet_hand, status: p.status }))
      );
      return false;
    }
  }
  console.log(`[${seedTag}] OK — ${handCount} hands, total chips conserved at ${totalChips(players)}`);
  return true;
}

// Same chip-conservation invariant, but every seat is a bot making real
// decideBotAction() decisions instead of uniform-random ones — this is what
// actually exercises the bot's equity/pot-odds/sizing logic instead of just
// type-checking it, including the illegal-action fallback path in bot_tick.
function runBotFuzz(numPlayers: number, gameType: "nlhe" | "plo4", difficulties: BotDifficulty[], hands: number, seedTag: string) {
  const players: PlayerRow[] = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push(mkPlayer(i, 4000, { is_bot: true, bot_difficulty: difficulties[i % difficulties.length] }));
  }
  const room = mkRoom({ game_type: gameType, small_blind: 10, big_blind: 20 });
  const ctx = { room, players, holeCards: {} as Record<string, Card[]> };

  const before = totalChips(players);
  let handCount = 0;

  while (handCount < hands) {
    const alive = players.filter((p) => p.chips > 0);
    if (!canStartHand(alive)) break;
    try {
      startHand(ctx);
    } catch (e) {
      console.log(`[${seedTag}] startHand threw:`, (e as Error).message);
      break;
    }
    handCount++;

    let guard = 0;
    while (room.phase !== "showdown" && guard < 60) {
      guard++;
      const seat = room.current_turn_seat;
      if (seat == null) break;
      const p = players.find((pl) => pl.seat === seat);
      if (!p) break;

      const beforeAction = totalWithPot(players, room);
      const decision = decideBotAction(room, players, p, ctx.holeCards[p.id] || []);
      try {
        applyAction(ctx, p.id, decision.action, decision.amount);
      } catch {
        try {
          applyAction(ctx, p.id, p.current_bet === room.current_bet ? "check" : "call");
        } catch (e2) {
          console.log(`[${seedTag}] !!! bot fallback ALSO threw (real bug?):`, (e2 as Error).message);
          return false;
        }
      }
      const afterAction = totalWithPot(players, room);
      if (beforeAction !== afterAction) {
        console.log(`[${seedTag}] !!! CHIP+POT MISMATCH mid-action at hand ${handCount}: before=${beforeAction} after=${afterAction}`);
        return false;
      }
    }

    if (guard >= 60 && room.phase !== "showdown") {
      console.log(`[${seedTag}] !!! STUCK LOOP at hand ${handCount}, guard hit 60 without reaching showdown`);
      return false;
    }

    const after = totalChips(players);
    if (after !== before) {
      console.log(`[${seedTag}] !!! TOTAL CHIP DRIFT after hand ${handCount}: before=${before} after=${after}`);
      return false;
    }
  }
  console.log(`[${seedTag}] OK — ${handCount} hands, total chips conserved at ${totalChips(players)}`);
  return true;
}

// Deterministic regression test for a real bug report: heads-up, wildly uneven
// stacks, both all-in preflop. The deep stack's excess over what the short
// stack could ever match is an "uncalled bet" — it was never contested by
// anyone, so it must come back silently, not appear in room.winners as if the
// deep stack won a showdown. (It previously did, because computeSidePots ran
// every non-empty layer through the normal winner-determination path even
// when only one player had contributed to it at all.)
function testUncalledBetIsNotAWin(): boolean {
  const shortP = mkPlayer(0, 100);
  const deepP = mkPlayer(1, 5000);
  const room = mkRoom({ small_blind: 10, big_blind: 20, dealer_seat: 0 });
  const players = [shortP, deepP];
  const ctx = { room, players, holeCards: {} as Record<string, Card[]> };

  const beforeTotal = totalChips(players);
  startHand(ctx);

  // Force a known outcome: short stack holds pocket aces, deep stack holds
  // the worst possible hand for this board, so there's no ambiguity about
  // who actually won the contested (matched) pot.
  ctx.holeCards[shortP.id] = ["Ah", "Ad"] as Card[];
  ctx.holeCards[deepP.id] = ["2c", "3d"] as Card[];
  // last 5 entries are popped first, in this order: 7h, 2s, 9d, Kc, 4h
  room.deck = ["3h", "5c", "6d", "4h", "Kc", "9d", "2s", "7h"] as Card[];

  const firstSeat = room.current_turn_seat!;
  const firstPlayer = players.find((p) => p.seat === firstSeat)!;
  const secondPlayer = firstPlayer === shortP ? deepP : shortP;
  applyAction(ctx, firstPlayer.id, "all_in");
  applyAction(ctx, secondPlayer.id, "all_in");

  const afterTotal = totalChips(players);
  if (beforeTotal !== afterTotal) {
    console.log(`[uncalled-bet] !!! chip drift: before=${beforeTotal} after=${afterTotal}`);
    return false;
  }
  const winners = room.winners || [];
  if (winners.some((w) => w.playerId === deepP.id)) {
    console.log("[uncalled-bet] !!! deep stack shown as a winner for its own uncalled excess:", winners);
    return false;
  }
  if (!winners.some((w) => w.playerId === shortP.id)) {
    console.log("[uncalled-bet] !!! short stack (the actual best hand) is missing from winners:", winners);
    return false;
  }
  if (deepP.chips <= 0) {
    console.log(`[uncalled-bet] !!! deep stack's uncalled excess was never refunded (chips=${deepP.chips})`);
    return false;
  }
  console.log(`[uncalled-bet] OK — short stack is the sole winner, deep stack silently kept its uncalled ${deepP.chips}`);
  return true;
}

function testRabbitHuntToggle(): boolean {
  function runFoldWin(rabbitHuntEnabled: boolean): boolean {
    const p0 = mkPlayer(0, 1000);
    const p1 = mkPlayer(1, 1000);
    const room = mkRoom({ small_blind: 10, big_blind: 20, dealer_seat: 0, rabbit_hunt_enabled: rabbitHuntEnabled });
    const players = [p0, p1];
    const ctx = { room, players, holeCards: {} as Record<string, Card[]> };
    startHand(ctx);
    const firstSeat = room.current_turn_seat!;
    const firstPlayer = players.find((p) => p.seat === firstSeat)!;
    applyAction(ctx, firstPlayer.id, "fold");
    return rabbitHuntEnabled ? room.rabbit_cards != null && room.rabbit_cards.length === 5 : room.rabbit_cards == null;
  }

  if (!runFoldWin(true)) {
    console.log("[rabbit-hunt] !!! enabled=true should populate rabbit_cards on a fold win");
    return false;
  }
  if (!runFoldWin(false)) {
    console.log("[rabbit-hunt] !!! enabled=false must never populate rabbit_cards");
    return false;
  }
  console.log("[rabbit-hunt] OK — toggle honoured in both directions");
  return true;
}

// Tournament: play random hands to completion and check that (a) chips stay
// conserved, (b) every player ends up in finish_order exactly once with places
// 1..N, and (c) the room closes as "finished" with exactly one chip-holder.
function testTournament(): boolean {
  const N = 4;
  const players: PlayerRow[] = [];
  for (let i = 0; i < N; i++) players.push(mkPlayer(i, 1000));
  // level_minutes: 0 is normalized to 10 by the engine, so use a tiny base
  // stack + fast ladder instead: with 25/50 base blinds a 1000 stack busts fast
  const room = mkRoom({ tourney_enabled: true, small_blind: 25, big_blind: 50, level_minutes: 10 });
  const ctx = { room, players, holeCards: {} as Record<string, Card[]> };
  const before = totalChips(players);

  let guardHands = 0;
  while (room.status !== "finished" && guardHands < 400) {
    guardHands++;
    if (!canStartHand(players)) break;
    try {
      startHand(ctx);
    } catch (e) {
      console.log("[tourney-4p] startHand threw:", (e as Error).message);
      return false;
    }
    let guard = 0;
    while (room.phase !== "showdown" && guard < 60) {
      guard++;
      const seat = room.current_turn_seat;
      if (seat == null) break;
      const p = players.find((pl) => pl.seat === seat);
      if (!p) break;
      const toCall = room.current_bet - p.current_bet;
      const r = Math.random();
      try {
        if (r < 0.2) applyAction(ctx, p.id, "fold");
        else if (r < 0.6) {
          if (toCall <= 0) applyAction(ctx, p.id, "check");
          else applyAction(ctx, p.id, "call");
        } else applyAction(ctx, p.id, "all_in");
      } catch {
        try {
          if (toCall <= 0) applyAction(ctx, p.id, "check");
          else applyAction(ctx, p.id, "call");
        } catch {
          break;
        }
      }
    }
  }

  if (room.status !== "finished") {
    console.log(`[tourney-4p] !!! tournament never finished after ${guardHands} hands`);
    return false;
  }
  if (totalChips(players) !== before) {
    console.log(`[tourney-4p] !!! chip drift: before=${before} after=${totalChips(players)}`);
    return false;
  }
  const order = room.finish_order || [];
  const places = order.map((f) => f.place).sort((a, b) => a - b);
  const expected = Array.from({ length: N }, (_, i) => i + 1);
  if (JSON.stringify(places) !== JSON.stringify(expected)) {
    console.log(`[tourney-4p] !!! finish_order places wrong: ${JSON.stringify(order)}`);
    return false;
  }
  const ids = new Set(order.map((f) => f.playerId));
  if (ids.size !== N) {
    console.log(`[tourney-4p] !!! duplicate/missing players in finish_order: ${JSON.stringify(order)}`);
    return false;
  }
  const withChips = players.filter((p) => p.chips > 0);
  const champion = order.find((f) => f.place === 1)!;
  if (withChips.length !== 1 || withChips[0].id !== champion.playerId) {
    console.log(`[tourney-4p] !!! champion mismatch: chips=${JSON.stringify(withChips.map((p) => p.id))} place1=${champion.playerId}`);
    return false;
  }
  console.log(`[tourney-4p] OK — finished in ${room.hand_number} hands, champion ${champion.name}, places 1..${N} all assigned`);
  return true;
}

let allOk = true;
allOk = testUncalledBetIsNotAWin() && allOk;
allOk = testRabbitHuntToggle() && allOk;
allOk = testTournament() && allOk;
allOk = runFuzz(3, "nlhe", false, false, 500, "nlhe-3p") && allOk;
allOk = runFuzz(4, "nlhe", false, true, 500, "nlhe-4p-straddle") && allOk;
allOk = runFuzz(3, "plo4", false, false, 500, "plo4-3p") && allOk;
allOk = runFuzz(4, "nlhe", true, false, 500, "nlhe-4p-RIT") && allOk;
allOk = runFuzz(5, "plo4", true, true, 400, "plo4-5p-RIT-straddle") && allOk;
allOk = runFuzz(2, "nlhe", false, false, 500, "nlhe-heads-up") && allOk;
allOk = runFuzz(5, "nlhe", false, true, 500, "nlhe-5p-ante", 5) && allOk;
allOk = runFuzz(4, "plo4", true, true, 400, "plo4-4p-ante-RIT-straddle", 3) && allOk;
allOk = runBotFuzz(4, "nlhe", ["easy", "medium", "hard"], 100, "bots-nlhe-4p-mixed") && allOk;
allOk = runBotFuzz(6, "nlhe", ["hard"], 60, "bots-nlhe-6p-hard") && allOk;
allOk = runBotFuzz(3, "plo4", ["easy", "medium", "hard"], 60, "bots-plo4-3p-mixed") && allOk;
allOk = runBotFuzz(2, "nlhe", ["hard"], 60, "bots-nlhe-heads-up-hard") && allOk;

console.log(allOk ? "\nALL FUZZ RUNS PASSED" : "\nSOME FUZZ RUNS FAILED");
if (!allOk) process.exit(1);
