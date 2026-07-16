import { Card, Rank, Suit } from "./types.ts";

const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS: Suit[] = ["c", "d", "h", "s"];
const RANK_VALUE: Record<Rank, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i + 2])
) as Record<Rank, number>;

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(`${r}${s}` as Card);
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 5-card hand scoring. Returns a comparable number array: [rankCategory, ...tiebreakers]
// rankCategory: 8 straight flush, 7 quads, 6 full house, 5 flush, 4 straight,
// 3 trips, 2 two pair, 1 pair, 0 high card
function scoreFive(cards: Card[]): number[] {
  const ranks = cards.map((c) => RANK_VALUE[c[0] as Rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c[1] as Suit);

  const isFlush = suits.every((s) => s === suits[0]);

  const counts: Record<number, number> = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([r, c]) => ({ r: Number(r), c }))
    .sort((a, b) => (b.c - a.c) || (b.r - a.r));

  const uniqueDesc = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniqueDesc.length === 5) {
    if (uniqueDesc[0] - uniqueDesc[4] === 4) straightHigh = uniqueDesc[0];
    else if (uniqueDesc.join(",") === "14,5,4,3,2") straightHigh = 5; // wheel A-2-3-4-5
  }

  if (straightHigh && isFlush) return [8, straightHigh];
  if (groups[0].c === 4) return [7, groups[0].r, groups[1].r];
  if (groups[0].c === 3 && groups[1].c === 2) return [6, groups[0].r, groups[1].r];
  if (isFlush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].c === 3) return [3, groups[0].r, ...groups.slice(1).map((g) => g.r)];
  if (groups[0].c === 2 && groups[1].c === 2) {
    const kicker = groups[2].r;
    return [2, Math.max(groups[0].r, groups[1].r), Math.min(groups[0].r, groups[1].r), kicker];
  }
  if (groups[0].c === 2) return [1, groups[0].r, ...groups.slice(1).map((g) => g.r)];
  return [0, ...ranks];
}

function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

const HAND_NAMES = [
  "Carta Alta",
  "Par",
  "Dois Pares",
  "Trinca",
  "Sequência",
  "Flush",
  "Full House",
  "Quadra",
  "Straight Flush",
];

function combinations<T>(arr: T[], k: number): T[][] {
  const results: T[][] = [];
  const combo: T[] = [];
  function go(start: number) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      go(i + 1);
      combo.pop();
    }
  }
  go(0);
  return results;
}

export function evaluate7(cards: Card[]): { score: number[]; name: string } {
  let best: number[] | null = null;
  for (const five of combinations(cards, 5)) {
    const s = scoreFive(five);
    if (!best || compareScores(s, best) > 0) best = s;
  }
  return { score: best!, name: HAND_NAMES[best![0]] };
}

// Omaha rule: the final hand must use exactly 2 of the 4 hole cards + exactly 3 of the board.
export function evaluateOmaha(hole: Card[], board: Card[]): { score: number[]; name: string } {
  let best: number[] | null = null;
  for (const twoHole of combinations(hole, 2)) {
    for (const threeBoard of combinations(board, 3)) {
      const s = scoreFive([...twoHole, ...threeBoard]);
      if (!best || compareScores(s, best) > 0) best = s;
    }
  }
  return { score: best!, name: HAND_NAMES[best![0]] };
}

export function compareHands(a: Card[], b: Card[]): number {
  return compareScores(evaluate7(a).score, evaluate7(b).score);
}
