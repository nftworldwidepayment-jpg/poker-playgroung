import { Card, GameType, PlayerAction, PlayerRow, RoomRow } from "./types.ts";
import { evaluate7, evaluateOmaha, freshDeck, shuffle } from "./cards.ts";

export type BotDifficulty = "easy" | "medium" | "hard";

export interface BotDecision {
  action: PlayerAction;
  amount?: number;
}

// ── Equity estimation ────────────────────────────────────────────────────
// Monte Carlo: for each trial, deal random hole cards to every live opponent
// and a random completion of the board out to the river, then see how often
// the bot's hand is best (splitting on ties). This is the same technique
// real solvers/trainers use to reason about "how good is my hand right now"
// before pot odds ever enter the picture — no static hand-rank tables.
function evaluateFinal(hole: Card[], board: Card[], gameType: GameType): number[] {
  return gameType === "plo4" ? evaluateOmaha(hole, board).score : evaluate7([...hole, ...board]).score;
}

function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function estimateEquity(
  hole: Card[],
  board: Card[],
  numOpponents: number,
  gameType: GameType,
  iterations: number
): number {
  if (numOpponents <= 0) return 1;
  const cardsPerPlayer = gameType === "plo4" ? 4 : 2;
  const used = new Set<Card>([...hole, ...board]);
  const unseen = freshDeck().filter((c) => !used.has(c));
  const remainingBoard = 5 - board.length;
  let wins = 0;

  for (let i = 0; i < iterations; i++) {
    const draw = shuffle(unseen);
    let idx = 0;
    const oppHoles: Card[][] = [];
    for (let o = 0; o < numOpponents; o++) {
      oppHoles.push(draw.slice(idx, idx + cardsPerPlayer));
      idx += cardsPerPlayer;
    }
    const fullBoard = [...board, ...draw.slice(idx, idx + remainingBoard)];

    const heroScore = evaluateFinal(hole, fullBoard, gameType);
    let bestOppScore: number[] | null = null;
    for (const oh of oppHoles) {
      const s = evaluateFinal(oh, fullBoard, gameType);
      if (!bestOppScore || compareScores(s, bestOppScore) > 0) bestOppScore = s;
    }
    const cmp = bestOppScore ? compareScores(heroScore, bestOppScore) : 1;
    if (cmp > 0) wins += 1;
    else if (cmp === 0) wins += 0.5; // split pot
  }
  return wins / iterations;
}

// ── Position ──────────────────────────────────────────────────────────────
// 0 = acts first after the dealer (worst), 1 = the button itself (best) —
// a continuous stand-in for "early/middle/late position" that works the same
// way regardless of how many players are still live in the hand.
function positionScore(players: PlayerRow[], dealerSeat: number | null, botId: string): number {
  const live = players.filter((p) => p.status === "active" || p.status === "all_in");
  if (live.length <= 1) return 1;
  const ordered = [...live].sort((a, b) => {
    const da = (a.seat - (dealerSeat ?? 0) + 1000) % 1000;
    const db = (b.seat - (dealerSeat ?? 0) + 1000) % 1000;
    return da - db;
  });
  const idx = ordered.findIndex((p) => p.id === botId);
  if (idx === -1) return 0.5;
  return idx / (ordered.length - 1);
}

interface DifficultyProfile {
  iterations: number;
  // how much slack to give equity vs. pure pot odds before folding — positive
  // means calling looser than "correct" (a beginner leak), negative means
  // folding tighter than strictly required (a disciplined, professional edge)
  foldSlack: number;
  raiseEquity: number; // baseline equity needed to bet/raise for value
  positionWeight: number; // how much good position lowers the raise/continue bar
  bluffFrequency: number; // chance to raise as a bluff despite weak equity
  sizings: number[]; // pot-fraction options for a value bet/raise
  threeBetAggression: number; // extra equity bonus applied when re-raising a raise, versus a coldcall
  shoveSprThreshold: number; // if stack/pot below this, consider shoving instead of calling
}

const PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  // Loose-passive "calling station" — the single most common leak in beginner
  // players: overvalues any pair/draw, rarely raises for value, never bluffs.
  easy: {
    iterations: 60,
    foldSlack: 0.12,
    raiseEquity: 0.78,
    positionWeight: 0.05,
    bluffFrequency: 0,
    sizings: [0.33],
    threeBetAggression: 0,
    shoveSprThreshold: 0.4,
  },
  // Solid tight-aggressive (TAG) regular — folds to bad odds, raises a
  // reasonably wide value range, occasional bluff, standard 1/2–2/3 pot sizing.
  medium: {
    iterations: 150,
    foldSlack: 0,
    raiseEquity: 0.6,
    positionWeight: 0.12,
    bluffFrequency: 0.08,
    sizings: [0.5, 0.66],
    threeBetAggression: 0.05,
    shoveSprThreshold: 0.8,
  },
  // Professional-style: tighter continue threshold out of position, wider and
  // more aggressive in position, polarized sizing (small or big, rarely
  // medium), a real bluffing frequency mixed in via a randomized threshold so
  // the strategy can't be read off a fixed rule (the core idea behind a
  // balanced/GTO-inspired range), and short-stack shove logic by SPR.
  hard: {
    iterations: 300,
    foldSlack: -0.03,
    raiseEquity: 0.52,
    positionWeight: 0.22,
    bluffFrequency: 0.2,
    sizings: [0.33, 0.75, 1.25],
    threeBetAggression: 0.12,
    shoveSprThreshold: 1.1,
  },
};

export function decideBotAction(
  room: RoomRow,
  players: PlayerRow[],
  bot: PlayerRow,
  holeCards: Card[]
): BotDecision {
  const profile = PROFILES[(bot.bot_difficulty as BotDifficulty) || "medium"];
  const toCall = Math.max(0, room.current_bet - bot.current_bet);
  const pot = room.pot;
  const opponents = players.filter(
    (p) => p.id !== bot.id && (p.status === "active" || p.status === "all_in")
  ).length;

  const equity = estimateEquity(holeCards, room.community_cards, Math.max(1, opponents), room.game_type, profile.iterations);
  const posScore = positionScore(players, room.dealer_seat, bot.id);
  const positionBonus = (posScore - 0.5) * 2 * profile.positionWeight; // -weight..+weight

  const facingRaise = room.current_bet > room.big_blind * (room.ante > 0 ? 1 : 2) && toCall > 0;
  const continueEquityNeeded = toCall > 0 ? toCall / (pot + toCall) - profile.foldSlack - positionBonus : 0;
  const raiseEquityNeeded = profile.raiseEquity - positionBonus - (facingRaise ? profile.threeBetAggression : 0);

  const spr = bot.chips / Math.max(pot, 1);
  const wantsBluff = Math.random() < profile.bluffFrequency && opponents <= 2;

  function raiseTarget(potFraction: number): number {
    const potAfterCall = pot + toCall;
    const raw = room.current_bet + Math.max(room.big_blind, Math.round(potAfterCall * potFraction));
    return Math.min(raw, bot.chips + bot.current_bet);
  }

  // Short-stacked: professionals shove rather than call-and-fold-later once
  // there isn't enough behind to make postflop play meaningful.
  if (toCall > 0 && spr <= profile.shoveSprThreshold && equity >= 0.42) {
    return { action: "all_in" };
  }

  if (equity >= raiseEquityNeeded || wantsBluff) {
    const sizing = profile.sizings[Math.floor(Math.random() * profile.sizings.length)];
    const target = raiseTarget(sizing);
    if (target > room.current_bet && target - bot.current_bet >= bot.chips * 0.98) {
      return { action: "all_in" };
    }
    if (target > room.current_bet) {
      return { action: "raise", amount: target };
    }
  }

  if (toCall === 0) return { action: "check" };
  if (equity + 1e-9 >= continueEquityNeeded) return { action: "call" };
  return { action: "fold" };
}
