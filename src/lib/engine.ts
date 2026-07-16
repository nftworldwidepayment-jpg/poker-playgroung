import { Card, PlayerRow, RoomRow } from "./types";
import { evaluate7, evaluateOmaha, freshDeck, shuffle } from "./cards";

const TURN_SECONDS = 30;

export interface GameCtx {
  room: RoomRow;
  players: PlayerRow[];
  holeCards: Record<string, Card[]>;
}

function turnDeadline(): string {
  return new Date(Date.now() + TURN_SECONDS * 1000).toISOString();
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
  return players.filter((p) => p.status !== "left" && p.chips > 0).length >= 2;
}

export function startHand(ctx: GameCtx) {
  const { room, players } = ctx;
  const eligible = players.filter((p) => p.status !== "left" && p.chips > 0);
  if (eligible.length < 2) throw new Error("Não há jogadores suficientes");

  for (const p of players) {
    if (p.status === "left") continue;
    if (p.chips > 0) {
      p.status = "active";
      p.current_bet = 0;
      p.total_bet_hand = 0;
      p.has_acted = false;
    } else {
      p.status = "sitting_out";
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

  const sbPlayer = players.find((p) => p.seat === sbSeat)!;
  const bbPlayer = players.find((p) => p.seat === bbSeat)!;

  const sbAmt = Math.min(room.small_blind, sbPlayer.chips);
  sbPlayer.chips -= sbAmt;
  sbPlayer.current_bet = sbAmt;
  sbPlayer.total_bet_hand = sbAmt;
  if (sbPlayer.chips === 0) sbPlayer.status = "all_in";

  const bbAmt = Math.min(room.big_blind, bbPlayer.chips);
  bbPlayer.chips -= bbAmt;
  bbPlayer.current_bet = bbAmt;
  bbPlayer.total_bet_hand = bbAmt;
  if (bbPlayer.chips === 0) bbPlayer.status = "all_in";

  const deck = shuffle(freshDeck());
  const cardsPerPlayer = room.game_type === "plo4" ? 4 : 2;
  for (const p of eligible) {
    const hand: Card[] = [];
    for (let i = 0; i < cardsPerPlayer; i++) hand.push(deck.pop()!);
    ctx.holeCards[p.id] = hand;
  }

  room.deck = deck;
  room.community_cards = [];
  room.pot = sbAmt + bbAmt;
  room.pots = [];
  room.current_bet = bbAmt;
  room.min_raise = room.big_blind;
  room.phase = "preflop";
  room.status = "playing";
  room.dealer_seat = dealerSeat;
  room.hand_number += 1;
  room.winners = null;
  room.revealed_hands = null;
  room.last_action = null;

  const firstToAct = nextSeat(players, bbSeat, (p) => p.status === "active");
  room.current_turn_seat = firstToAct;
  room.turn_expires_at = firstToAct != null ? turnDeadline() : null;

  if (firstToAct == null) {
    advanceStreet(ctx);
  }
}

function computeSidePots(players: PlayerRow[]) {
  const contribs = players
    .filter((p) => p.total_bet_hand > 0)
    .map((p) => ({ id: p.id, amt: p.total_bet_hand, folded: p.status === "folded" }));
  const levels = [...new Set(contribs.map((c) => c.amt))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: string[] }[] = [];
  let prev = 0;
  for (const level of levels) {
    const contributors = contribs.filter((c) => c.amt >= level);
    const layer = (level - prev) * contributors.length;
    const eligible = contributors.filter((c) => !c.folded).map((c) => c.id);
    if (layer > 0 && eligible.length > 0) pots.push({ amount: layer, eligible });
    prev = level;
  }
  return pots;
}

function showdown(ctx: GameCtx) {
  const { room, players, holeCards } = ctx;
  const inHand = players.filter((p) => p.status === "active" || p.status === "all_in");
  const pots = computeSidePots(players);
  const wins: Record<string, { playerId: string; name: string; amount: number; hand: string }> = {};

  const seatsAfterDealer = [...players]
    .filter((p) => inHand.includes(p))
    .sort((a, b) => {
      const da = (a.seat - (room.dealer_seat ?? 0) + 1000) % 1000;
      const db = (b.seat - (room.dealer_seat ?? 0) + 1000) % 1000;
      return da - db;
    });

  for (const pot of pots) {
    const eligible = inHand.filter((p) => pot.eligible.includes(p.id));
    if (eligible.length === 0) continue;
    let best: { player: PlayerRow; score: number[]; name: string } | null = null;
    const scored = eligible.map((p) => {
      const ev =
        room.game_type === "plo4"
          ? evaluateOmaha(holeCards[p.id] || [], room.community_cards)
          : evaluate7([...(holeCards[p.id] || []), ...room.community_cards]);
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
      p.chips += amt;
      if (!wins[p.id]) wins[p.id] = { playerId: p.id, name: p.name, amount: 0, hand: w.name };
      wins[p.id].amount += amt;
    }
  }

  room.winners = Object.values(wins);
  room.revealed_hands = inHand.map((p) => ({ playerId: p.id, cards: holeCards[p.id] || [] }));
  room.pot = 0;
  room.pots = [];
  room.phase = "showdown";
  room.current_turn_seat = null;
  room.turn_expires_at = null;
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
    advanceStreet(ctx);
    return;
  }
  room.current_turn_seat = firstToAct;
  room.turn_expires_at = turnDeadline();
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
    const isFullRaise = target - room.current_bet >= room.min_raise;
    player.chips -= delta;
    player.current_bet = target;
    player.total_bet_hand += delta;
    if (player.chips === 0) player.status = "all_in";
    if (target > room.current_bet) {
      if (isFullRaise) room.min_raise = target - room.current_bet;
      room.current_bet = target;
      for (const p of players) {
        if (p.id !== player.id && p.status === "active") p.has_acted = false;
      }
    }
  } else if (action === "all_in") {
    const delta = player.chips;
    const target = player.current_bet + delta;
    player.chips = 0;
    player.current_bet = target;
    player.total_bet_hand += delta;
    player.status = "all_in";
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
  room.turn_expires_at = turnDeadline();
}

export function applyTimeout(ctx: GameCtx) {
  const { room, players } = ctx;
  const player = players.find((p) => p.seat === room.current_turn_seat);
  if (!player) return;
  if (player.current_bet === room.current_bet) {
    applyAction(ctx, player.id, "check");
  } else {
    applyAction(ctx, player.id, "fold");
  }
}
