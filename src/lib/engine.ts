import { Card, PlayerRow, RoomRow } from "./types";
import { evaluate7, evaluateOmaha, freshDeck, shuffle } from "./cards";

const DEFAULT_TURN_SECONDS = 30;

export interface GameCtx {
  room: RoomRow;
  players: PlayerRow[];
  holeCards: Record<string, Card[]>;
}

function turnDeadline(room: RoomRow): string {
  const seconds = room.turn_seconds || DEFAULT_TURN_SECONDS;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function nextSeat(
  players: PlayerRow[],
  fromSeat: number,
  predicate: (p: PlayerRow) => boolean
): number | null {
  const seats = [...new Set(players.map((p) => p.seat))].sort((a, b) => a - b);
  const startIdx = seats.findIndex((s) => s > fromSeat);
  const order =
    startIdx === -1 ? seats : [...seats.slice(startIdx), ...seats.slice(0, startIdx)];
  for (const s of order) {
    if (s === fromSeat) continue;
    const p = players.find((pl) => pl.seat === s);
    if (p && predicate(p)) return s;
  }
  return null;
}

export function canStartHand(players: PlayerRow[]): boolean {
  return players.filter((p) => p.status !== "left" && p.chips > 0 && !p.wants_sit_out).length >= 2;
}

export function startHand(ctx: GameCtx) {
  const { room, players } = ctx;

  // snapshot the hand that just finished (if any) before we reset everything
  if (room.winners && room.winners.length > 0) {
    room.last_hand = {
      handNumber: room.hand_number,
      board: room.community_cards,
      winners: room.winners,
      revealedHands: room.revealed_hands,
    };
  }

  const eligible = players.filter((p) => p.status !== "left" && p.chips > 0 && !p.wants_sit_out);
  if (eligible.length < 2) throw new Error("Não há jogadores suficientes");

  for (const p of players) {
    if (p.status === "left") continue;
    if (p.chips > 0 && !p.wants_sit_out) {
      p.status = "active";
      p.current_bet = 0;
      p.total_bet_hand = 0;
      p.has_acted = false;
    } else {
      // busted players and anyone who opted to sit out must not carry a stale
      // total_bet_hand into future hands — left uncleared, computeSidePots/
      // awardFoldWin would keep reading their old contribution as if it were
      // part of THIS hand's pot, phantom-crediting chips to whoever it made
      // "eligible" for a side pot.
      p.status = "sitting_out";
      p.current_bet = 0;
      p.total_bet_hand = 0;
    }
  }

  const seats = eligible.map((p) => p.seat).sort((a, b) => a - b);
  const N = seats.length;
  let dealerSeat = room.dealer_seat;
  if (dealerSeat == null || !seats.includes(dealerSeat)) {
    dealerSeat = seats[0];
  } else {
    const next = nextSeat(players, dealerSeat, (p) => p.status === "active");
    dealerSeat = next ?? seats[0];
  }
  const dealerIdx = seats.indexOf(dealerSeat);

  let sbIdx: number, bbIdx: number;
  if (N === 2) {
    sbIdx = dealerIdx;
    bbIdx = (dealerIdx + 1) % N;
  } else {
    sbIdx = (dealerIdx + 1) % N;
    bbIdx = (dealerIdx + 2) % N;
  }
  const sbSeat = seats[sbIdx];
  const bbSeat = seats[bbIdx];

  // ante: every dealt-in player posts it straight into the pot before blinds —
  // unlike a blind/straddle it never counts toward current_bet (nobody "calls"
  // an ante), it only adds to total_bet_hand so computeSidePots/awardFoldWin
  // pick it up as part of the pot exactly like any other contribution.
  if (room.ante > 0) {
    for (const p of eligible) {
      const anteAmt = Math.min(room.ante, p.chips);
      p.chips -= anteAmt;
      p.total_bet_hand += anteAmt;
      if (p.chips === 0) p.status = "all_in";
    }
  }

  const sbPlayer = players.find((p) => p.seat === sbSeat)!;
  const bbPlayer = players.find((p) => p.seat === bbSeat)!;

  const sbAmt = Math.min(room.small_blind, sbPlayer.chips);
  sbPlayer.chips -= sbAmt;
  sbPlayer.current_bet = sbAmt;
  sbPlayer.total_bet_hand += sbAmt;
  if (sbPlayer.chips === 0) sbPlayer.status = "all_in";

  const bbAmt = Math.min(room.big_blind, bbPlayer.chips);
  bbPlayer.chips -= bbAmt;
  bbPlayer.current_bet = bbAmt;
  bbPlayer.total_bet_hand += bbAmt;
  if (bbPlayer.chips === 0) bbPlayer.status = "all_in";

  // optional straddle: the player directly after BB may opt in (via auto_straddle)
  // to post 2x BB blind, which raises the effective preflop bet and shifts first action —
  // gated by room.allow_straddle so a table can be created with straddling disabled entirely
  let straddleSeat: number | null = null;
  let openingBet = bbAmt;
  let openingMinRaise = room.big_blind;
  if (N > 2 && room.allow_straddle) {
    const straddleSeatCandidate = seats[(bbIdx + 1) % N];
    const straddlePlayer = players.find((p) => p.seat === straddleSeatCandidate);
    if (
      straddlePlayer &&
      straddlePlayer.status === "active" &&
      straddlePlayer.auto_straddle &&
      straddlePlayer.chips >= room.big_blind * 2
    ) {
      const straddleAmt = room.big_blind * 2;
      straddlePlayer.chips -= straddleAmt;
      straddlePlayer.current_bet = straddleAmt;
      straddlePlayer.total_bet_hand += straddleAmt;
      if (straddlePlayer.chips === 0) straddlePlayer.status = "all_in";
      openingBet = straddleAmt;
      openingMinRaise = straddleAmt - bbAmt;
      straddleSeat = straddleSeatCandidate;
    }
  }

  const deck = shuffle(freshDeck());
  const cardsPerPlayer = room.game_type === "plo4" ? 4 : 2;
  for (const p of eligible) {
    const hand: Card[] = [];
    for (let i = 0; i < cardsPerPlayer; i++) hand.push(deck.pop()!);
    ctx.holeCards[p.id] = hand;
  }

  room.deck = deck;
  room.community_cards = [];
  room.pot = players.reduce((s, p) => s + p.total_bet_hand, 0);
  room.pots = [];
  room.current_bet = openingBet;
  room.min_raise = openingMinRaise;
  room.phase = "preflop";
  room.status = "playing";
  room.dealer_seat = dealerSeat;
  room.hand_number += 1;
  room.winners = null;
  room.revealed_hands = null;
  room.last_action = null;
  room.rabbit_cards = null;
  room.run_it_twice_boards = null;
  room.all_in_equity = null;

  const firstToAct = nextSeat(players, straddleSeat ?? bbSeat, (p) => p.status === "active");
  room.current_turn_seat = firstToAct;
  room.turn_expires_at = firstToAct != null ? turnDeadline(room) : null;

  if (firstToAct == null) {
    advanceStreet(ctx);
  }
}

function computeSidePots(players: PlayerRow[]): {
  pots: { amount: number; eligible: string[] }[];
  refunds: Record<string, number>;
} {
  const contribs = players
    .filter((p) => p.total_bet_hand > 0)
    .map((p) => ({ id: p.id, amt: p.total_bet_hand, folded: p.status === "folded" }));
  const levels = [...new Set(contribs.map((c) => c.amt))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: string[] }[] = [];
  const refunds: Record<string, number> = {};
  let prev = 0;
  for (const level of levels) {
    const contributors = contribs.filter((c) => c.amt >= level);
    const perPlayer = level - prev;
    const layer = perPlayer * contributors.length;
    const eligible = contributors.filter((c) => !c.folded).map((c) => c.id);
    if (layer > 0) {
      if (eligible.length > 0) {
        pots.push({ amount: layer, eligible });
      } else {
        // Every contributor at this level has folded (possible when a PLO4 pot-limit
        // cap leaves someone "active" with excess chips wagered, who then folds before
        // anyone else matches their contribution) — refund it instead of vanishing it.
        for (const c of contributors) refunds[c.id] = (refunds[c.id] ?? 0) + perPlayer;
      }
    }
    prev = level;
  }
  return { pots, refunds };
}

function seatOrderAfterDealer(players: PlayerRow[], dealerSeat: number | null, inHand: PlayerRow[]): PlayerRow[] {
  return [...players]
    .filter((p) => inHand.includes(p))
    .sort((a, b) => {
      const da = (a.seat - (dealerSeat ?? 0) + 1000) % 1000;
      const db = (b.seat - (dealerSeat ?? 0) + 1000) % 1000;
      return da - db;
    });
}

// Splits a set of pots among the best hand(s) on a given board, using the odd-chip-to-
// first-winner-after-dealer rule. Pure: returns the distribution without touching chips,
// so it can be called twice (once per board) for run-it-twice hands.
function distributeAmongWinners(
  ctx: GameCtx,
  pots: { amount: number; eligible: string[] }[],
  board: Card[],
  inHand: PlayerRow[],
  seatsAfterDealer: PlayerRow[]
): Record<string, { playerId: string; name: string; amount: number; hand: string }> {
  const { room, holeCards } = ctx;
  const wins: Record<string, { playerId: string; name: string; amount: number; hand: string }> = {};

  for (const pot of pots) {
    const eligible = inHand.filter((p) => pot.eligible.includes(p.id));
    if (eligible.length === 0 || pot.amount <= 0) continue;
    let best: { player: PlayerRow; score: number[]; name: string } | null = null;
    const scored = eligible.map((p) => {
      const ev =
        room.game_type === "plo4"
          ? evaluateOmaha(holeCards[p.id] || [], board)
          : evaluate7([...(holeCards[p.id] || []), ...board]);
      return { player: p, score: ev.score, name: ev.name };
    });
    for (const s of scored) {
      if (!best || compareScoreArrays(s.score, best.score) > 0) best = s;
    }
    const winners = scored.filter((s) => compareScoreArrays(s.score, best!.score) === 0);
    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;
    // odd chip goes to first winner in seat order after dealer
    const orderedWinners = seatsAfterDealer.filter((p) => winners.some((w) => w.player.id === p.id));
    for (const p of orderedWinners) {
      const w = winners.find((x) => x.player.id === p.id)!;
      let amt = share;
      if (remainder > 0) {
        amt += 1;
        remainder -= 1;
      }
      if (!wins[p.id]) wins[p.id] = { playerId: p.id, name: p.name, amount: 0, hand: w.name };
      wins[p.id].amount += amt;
    }
  }
  return wins;
}

function finishShowdown(ctx: GameCtx, inHand: PlayerRow[]) {
  const { room, holeCards } = ctx;
  room.revealed_hands = inHand.map((p) => ({ playerId: p.id, cards: holeCards[p.id] || [] }));
  room.pot = 0;
  room.pots = [];
  room.phase = "showdown";
  room.current_turn_seat = null;
  room.turn_expires_at = null;
}

function showdown(ctx: GameCtx) {
  const { room, players } = ctx;
  const inHand = players.filter((p) => p.status === "active" || p.status === "all_in");
  const { pots, refunds } = computeSidePots(players);
  for (const id in refunds) {
    const p = players.find((pl) => pl.id === id);
    if (p) p.chips += refunds[id];
  }
  const seatsAfterDealer = seatOrderAfterDealer(players, room.dealer_seat, inHand);
  const wins = distributeAmongWinners(ctx, pots, room.community_cards, inHand, seatsAfterDealer);
  for (const id in wins) {
    const p = players.find((pl) => pl.id === id)!;
    p.chips += wins[id].amount;
  }
  room.winners = Object.values(wins);
  finishShowdown(ctx, inHand);
}

function showdownRunItTwice(ctx: GameCtx, boards: [Card[], Card[]]) {
  const { room, players } = ctx;
  const inHand = players.filter((p) => p.status === "active" || p.status === "all_in");
  const { pots, refunds } = computeSidePots(players);
  for (const id in refunds) {
    const p = players.find((pl) => pl.id === id);
    if (p) p.chips += refunds[id];
  }
  const seatsAfterDealer = seatOrderAfterDealer(players, room.dealer_seat, inHand);
  // each board is responsible for half of every pot (odd chip alternates to board A)
  const potsA = pots.map((p) => ({ ...p, amount: Math.ceil(p.amount / 2) }));
  const potsB = pots.map((p, i) => ({ ...p, amount: p.amount - potsA[i].amount }));
  const winsA = distributeAmongWinners(ctx, potsA, boards[0], inHand, seatsAfterDealer);
  const winsB = distributeAmongWinners(ctx, potsB, boards[1], inHand, seatsAfterDealer);

  const merged: Record<string, { playerId: string; name: string; amount: number; hand: string }> = {};
  for (const src of [winsA, winsB]) {
    for (const id in src) {
      if (!merged[id]) merged[id] = { ...src[id], amount: 0 };
      merged[id].amount += src[id].amount;
    }
  }
  for (const id in merged) {
    const nameA = winsA[id]?.hand;
    const nameB = winsB[id]?.hand;
    merged[id].hand = nameA && nameB && nameA !== nameB ? `${nameA} / ${nameB}` : nameA || nameB || merged[id].hand;
    const p = players.find((pl) => pl.id === id)!;
    p.chips += merged[id].amount;
  }
  room.winners = Object.values(merged);
  finishShowdown(ctx, inHand);
}

// Monte Carlo equity estimate for the players still contesting the pot, run right before
// the board is completed — purely informational, doesn't affect payouts.
function computeAllInEquity(ctx: GameCtx) {
  const { room, players, holeCards } = ctx;
  const contenders = players.filter((p) => p.status === "active" || p.status === "all_in");
  const remaining = 5 - room.community_cards.length;
  if (contenders.length < 2 || remaining <= 0) {
    room.all_in_equity = null;
    return;
  }
  const ITER = 200;
  const wins: Record<string, number> = {};
  for (const p of contenders) wins[p.id] = 0;
  for (let i = 0; i < ITER; i++) {
    const draw = shuffle(room.deck).slice(0, remaining);
    const board = [...room.community_cards, ...draw];
    let best: number[] | null = null;
    let bestIds: string[] = [];
    for (const p of contenders) {
      const ev =
        room.game_type === "plo4"
          ? evaluateOmaha(holeCards[p.id] || [], board)
          : evaluate7([...(holeCards[p.id] || []), ...board]);
      const cmp = best ? compareScoreArrays(ev.score, best) : 1;
      if (!best || cmp > 0) {
        best = ev.score;
        bestIds = [p.id];
      } else if (cmp === 0) {
        bestIds.push(p.id);
      }
    }
    const share = 1 / bestIds.length;
    for (const id of bestIds) wins[id] += share;
  }
  room.all_in_equity = contenders.map((p) => ({ playerId: p.id, pct: Math.round((wins[p.id] / ITER) * 1000) / 10 }));
}

// Completes the board once no one has any more decisions left to make (everyone remaining
// is all-in). Runs it once, or twice with an even pot split, if the room has that enabled.
function runOutBoard(ctx: GameCtx) {
  const { room } = ctx;
  computeAllInEquity(ctx);
  const remaining = 5 - room.community_cards.length;
  if (remaining <= 0) {
    showdown(ctx);
    return;
  }
  if (room.run_it_twice_enabled) {
    const pool = shuffle([...room.deck]);
    const boardA = [...room.community_cards, ...pool.slice(0, remaining)];
    const boardB = [...room.community_cards, ...pool.slice(remaining, remaining * 2)];
    room.deck = pool.slice(remaining * 2);
    room.run_it_twice_boards = [boardA, boardB];
    room.community_cards = boardA;
    showdownRunItTwice(ctx, [boardA, boardB]);
  } else {
    const deck = [...room.deck];
    const cards: Card[] = [];
    for (let i = 0; i < remaining; i++) cards.push(deck.pop()!);
    room.community_cards = [...room.community_cards, ...cards];
    room.deck = deck;
    showdown(ctx);
  }
}

function compareScoreArrays(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function awardFoldWin(ctx: GameCtx, winner: PlayerRow) {
  const { room, players } = ctx;
  const amount = players.reduce((sum, p) => sum + p.total_bet_hand, 0);
  winner.chips += amount;
  room.winners = [
    { playerId: winner.id, name: winner.name, amount, hand: "Vitória — os outros desistiram" },
  ];
  room.revealed_hands = null;
  // rabbit hunt: preview of the board that would have come, purely for curiosity —
  // doesn't touch the deck, since the hand is already decided.
  const remainingCards = 5 - room.community_cards.length;
  room.rabbit_cards = remainingCards > 0 ? [...room.deck].slice(-remainingCards).reverse() : null;
  room.pot = 0;
  room.pots = [];
  room.phase = "showdown";
  room.current_turn_seat = null;
  room.turn_expires_at = null;
}

export function advanceStreet(ctx: GameCtx) {
  const { room, players } = ctx;
  for (const p of players) {
    if (p.status === "active" || p.status === "all_in") {
      p.current_bet = 0;
      p.has_acted = p.status === "all_in";
    }
  }
  room.current_bet = 0;
  room.min_raise = room.big_blind;

  const deck = [...room.deck];
  if (room.phase === "preflop") {
    room.community_cards = [deck.pop()!, deck.pop()!, deck.pop()!];
    room.phase = "flop";
  } else if (room.phase === "flop") {
    room.community_cards = [...room.community_cards, deck.pop()!];
    room.phase = "turn";
  } else if (room.phase === "turn") {
    room.community_cards = [...room.community_cards, deck.pop()!];
    room.phase = "river";
  } else {
    room.deck = deck;
    showdown(ctx);
    return;
  }
  room.deck = deck;

  const firstToAct = nextSeat(players, room.dealer_seat ?? 0, (p) => p.status === "active");
  if (firstToAct == null) {
    // no one left who can act — everyone remaining is all-in, so complete the board in one go
    runOutBoard(ctx);
    return;
  }
  room.current_turn_seat = firstToAct;
  room.turn_expires_at = turnDeadline(room);
}

function roundComplete(players: PlayerRow[], currentBet: number): boolean {
  const canAct = players.filter((p) => p.status === "active");
  if (canAct.length === 0) return true;
  return canAct.every((p) => p.has_acted && p.current_bet === currentBet);
}

export function applyAction(
  ctx: GameCtx,
  playerId: string,
  action: "fold" | "check" | "call" | "raise" | "all_in",
  amount?: number
) {
  const { room, players } = ctx;
  const player = players.find((p) => p.id === playerId);
  if (!player) throw new Error("Jogador não encontrado");
  if (room.current_turn_seat !== player.seat) throw new Error("Não é a tua vez");
  if (player.status !== "active") throw new Error("Não podes agir agora");

  const name = player.name;

  if (action === "fold") {
    player.status = "folded";
  } else if (action === "check") {
    if (player.current_bet !== room.current_bet) throw new Error("Não podes dar check, há uma aposta");
  } else if (action === "call") {
    const need = Math.min(room.current_bet - player.current_bet, player.chips);
    player.chips -= need;
    player.current_bet += need;
    player.total_bet_hand += need;
    if (player.chips === 0) player.status = "all_in";
  } else if (action === "raise") {
    if (amount == null) throw new Error("Falta o valor da aposta");
    let target = Math.min(amount, player.chips + player.current_bet);
    if (room.game_type === "plo4") {
      const toCall = room.current_bet - player.current_bet;
      const potAfterCall = room.pot + toCall;
      const maxTotalBet = room.current_bet + potAfterCall;
      target = Math.min(target, maxTotalBet);
    }
    const delta = target - player.current_bet;
    if (delta <= 0 || delta > player.chips) throw new Error("Valor de raise inválido");
    // A "raise" must actually raise — if the PLO4 pot cap (or the caller-supplied
    // amount) clamps target down to no more than the current bet, this isn't a legal
    // raise at all (it would silently behave like a same-amount call while skipping
    // the has_acted reset below, corrupting round-completion logic for everyone else).
    if (target <= room.current_bet) throw new Error("Valor de raise inválido");
    const isFullRaise = target - room.current_bet >= room.min_raise;
    player.chips -= delta;
    player.current_bet = target;
    player.total_bet_hand += delta;
    if (player.chips === 0) player.status = "all_in";
    if (isFullRaise) room.min_raise = target - room.current_bet;
    room.current_bet = target;
    for (const p of players) {
      if (p.id !== player.id && p.status === "active") p.has_acted = false;
    }
  } else if (action === "all_in") {
    let delta = player.chips;
    if (room.game_type === "plo4") {
      // Pot-limit: pushing your stack is only legal up to the pot-size raise cap.
      // Anything beyond the cap stays in the stack — "all-in" in PLO means "bet the max",
      // which is the pot, never an uncapped shove.
      const toCall = room.current_bet - player.current_bet;
      const maxTotalBet = room.current_bet + room.pot + toCall;
      const maxDelta = maxTotalBet - player.current_bet;
      if (maxDelta > 0) delta = Math.min(delta, maxDelta);
      else delta = Math.min(player.chips, Math.max(toCall, 0));
    }
    const target = player.current_bet + delta;
    player.chips -= delta;
    player.current_bet = target;
    player.total_bet_hand += delta;
    if (player.chips === 0) player.status = "all_in";
    if (target > room.current_bet) {
      const isFullRaise = target - room.current_bet >= room.min_raise;
      if (isFullRaise) room.min_raise = target - room.current_bet;
      room.current_bet = target;
      for (const p of players) {
        if (p.id !== player.id && p.status === "active") p.has_acted = false;
      }
    }
  }

  player.has_acted = true;
  player.consecutive_timeouts = 0; // a real action from the player clears any AFK streak
  room.pot = players.reduce((s, p) => s + p.total_bet_hand, 0);
  room.last_action = { seat: player.seat, name, action, amount };

  const inHand = players.filter((p) => p.status === "active" || p.status === "all_in");
  if (inHand.length <= 1) {
    if (inHand.length === 1) awardFoldWin(ctx, inHand[0]);
    else {
      room.phase = "showdown";
      room.winners = [];
    }
    return;
  }

  if (roundComplete(players, room.current_bet)) {
    advanceStreet(ctx);
    return;
  }

  const next = nextSeat(players, player.seat, (p) => p.status === "active");
  if (next == null) {
    advanceStreet(ctx);
    return;
  }
  room.current_turn_seat = next;
  room.turn_expires_at = turnDeadline(room);
}

const AFK_SIT_OUT_THRESHOLD = 3;

export function applyTimeout(ctx: GameCtx) {
  const { room, players } = ctx;
  const player = players.find((p) => p.seat === room.current_turn_seat);
  if (!player) return;
  if (player.current_bet === room.current_bet) {
    applyAction(ctx, player.id, "check");
  } else {
    applyAction(ctx, player.id, "fold");
  }
  // applyAction just reset this to 0 as a real action would — but a server-forced
  // timeout isn't a real action, so re-apply the AFK streak on top of that. After a
  // few hands in a row of doing nothing but timing out, sit them out automatically
  // so they stop being dealt in (and folding blinds away) until they come back.
  player.consecutive_timeouts += 1;
  if (player.consecutive_timeouts >= AFK_SIT_OUT_THRESHOLD) {
    player.wants_sit_out = true;
  }
}

// Voluntary hand reveal after a hand ends — lets a player show their cards
// (e.g. to prove a bluff) even if they folded or weren't part of the showdown.
export function showHand(ctx: GameCtx, playerId: string) {
  const { room, holeCards } = ctx;
  if (room.phase !== "showdown") throw new Error("Só podes mostrar a mão depois da mão terminar");
  const cards = holeCards[playerId];
  if (!cards || !cards.length) throw new Error("Sem cartas para mostrar");
  const existing = room.revealed_hands || [];
  if (existing.some((r) => r.playerId === playerId)) return;
  room.revealed_hands = [...existing, { playerId, cards }];
}
