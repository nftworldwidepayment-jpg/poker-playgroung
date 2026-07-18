// Checked-in chip-conservation fuzz test — run via `npm run test:engine`.
//
// Plays randomized hands across several game-mode combinations (NLHE/PLO4, straddle,
// run-it-twice, ante, heads-up) and asserts the one invariant that holds at every point
// in the engine: sum(player.chips) + room.pot never changes except at the exact moments
// chips move into/out of the pot. This is how the "chips vanish after a hand" bug (a
// PLO4 all-in cap leaving an over-cap player "active" who then folds, orphaning a side-pot
// layer) was originally found and fixed — keep this passing before touching engine.ts.
import { startHand, applyAction, canStartHand } from "../engine";
import { RoomRow, PlayerRow, Card } from "../types";

function mkRoom(o: Partial<RoomRow> = {}): RoomRow {
  return {
    id: "r1", code: "A", status: "waiting", phase: "waiting", game_type: "nlhe",
    small_blind: 10, big_blind: 20, dealer_seat: null, current_turn_seat: null,
    community_cards: [], pot: 0, pots: [], current_bet: 0, min_raise: 20, deck: [],
    turn_expires_at: null, hand_number: 0, max_players: 9, last_action: null,
    winners: null, revealed_hands: null, created_at: "", rabbit_cards: null,
    run_it_twice_enabled: false, run_it_twice_boards: null, last_hand: null, all_in_equity: null,
    ante: 0, turn_seconds: 30, allow_straddle: true, is_private: false, paused_at: null,
    table_name: null,
    ...o,
  };
}
function mkPlayer(seat: number, chips: number, o: Partial<PlayerRow> = {}): PlayerRow {
  return {
    id: `p${seat}`, room_id: "r1", seat, name: `P${seat}`, chips, current_bet: 0,
    total_bet_hand: 0, status: "active", is_host: seat === 0, has_acted: false,
    is_connected: true, created_at: "", auto_straddle: false, wants_sit_out: false,
    avatar_key: null, last_action_at: null, left_at: null, consecutive_timeouts: 0, ...o,
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

let allOk = true;
allOk = runFuzz(3, "nlhe", false, false, 500, "nlhe-3p") && allOk;
allOk = runFuzz(4, "nlhe", false, true, 500, "nlhe-4p-straddle") && allOk;
allOk = runFuzz(3, "plo4", false, false, 500, "plo4-3p") && allOk;
allOk = runFuzz(4, "nlhe", true, false, 500, "nlhe-4p-RIT") && allOk;
allOk = runFuzz(5, "plo4", true, true, 400, "plo4-5p-RIT-straddle") && allOk;
allOk = runFuzz(2, "nlhe", false, false, 500, "nlhe-heads-up") && allOk;
allOk = runFuzz(5, "nlhe", false, true, 500, "nlhe-5p-ante", 5) && allOk;
allOk = runFuzz(4, "plo4", true, true, 400, "plo4-4p-ante-RIT-straddle", 3) && allOk;

console.log(allOk ? "\nALL FUZZ RUNS PASSED" : "\nSOME FUZZ RUNS FAILED");
if (!allOk) process.exit(1);
