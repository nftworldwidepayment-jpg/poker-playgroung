import { Card, Rank } from "./types";
import { freshDeck, shuffle } from "./cards";

// Single-player, client-only blackjack — unlike the poker table this never touches
// the server: there's no opponent to synchronize with, just you vs. the shoe, so
// keeping it 100% local is what makes it "muito rápido" (instant, no round trip).

export const MAX_HANDS = 5;
export const DECK_COUNT = 8;
// Reshuffle once the shoe burns past this fraction — real casino shoes use a cut
// card around here (roughly the last quarter) rather than dealing to the last card.
const RESHUFFLE_AT = Math.floor(DECK_COUNT * 52 * 0.25);

const RANK_VALUE: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  T: 10, J: 10, Q: 10, K: 10, A: 11,
};

export interface BJHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  finished: boolean;
  splitAce: boolean; // split aces get exactly one extra card, no further hitting
  result: "win" | "lose" | "push" | "blackjack" | null;
}

export type BJPhase = "betting" | "player" | "dealer" | "settled";

export interface BJState {
  shoe: Card[];
  hands: BJHand[];
  active: number;
  dealer: Card[];
  dealerHidden: boolean;
  phase: BJPhase;
  bankroll: number;
  currentBet: number;
  insuranceOffered: boolean;
  insuranceTaken: boolean;
  insuranceBet: number;
  message: string | null;
  handsPlayed: number;
}

function freshShoe(): Card[] {
  let cards: Card[] = [];
  for (let i = 0; i < DECK_COUNT; i++) cards = cards.concat(freshDeck());
  return shuffle(cards);
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = c[0] as Rank;
    total += RANK_VALUE[r];
    if (r === "A") aces++;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  if (aces === 0) soft = false;
  return { total, soft };
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function initState(bankroll = 1000): BJState {
  return {
    shoe: freshShoe(),
    hands: [],
    active: 0,
    dealer: [],
    dealerHidden: true,
    phase: "betting",
    bankroll,
    currentBet: 25,
    insuranceOffered: false,
    insuranceTaken: false,
    insuranceBet: 0,
    message: null,
    handsPlayed: 0,
  };
}

function draw(state: BJState): Card {
  if (state.shoe.length < 1) state.shoe = freshShoe();
  return state.shoe.pop()!;
}

export function setBet(state: BJState, bet: number) {
  state.currentBet = Math.max(1, Math.min(bet, state.bankroll));
}

// Deals a fresh round: one hand, two cards each. Handles the shoe-penetration
// reshuffle up front (never mid-hand, which would let a card come from a
// freshly-shuffled shoe mid-deal — subtle but a real "tell" bug in naive
// implementations) and immediately resolves naturals (player/dealer blackjack).
export function deal(state: BJState) {
  if (state.currentBet > state.bankroll) state.currentBet = state.bankroll;
  if (state.currentBet <= 0) return;
  if (state.shoe.length < RESHUFFLE_AT) state.shoe = freshShoe();

  state.bankroll -= state.currentBet;
  const hand: BJHand = { cards: [], bet: state.currentBet, doubled: false, finished: false, splitAce: false, result: null };
  state.hands = [hand];
  state.dealer = [];
  state.dealerHidden = true;
  state.active = 0;
  state.insuranceOffered = false;
  state.insuranceTaken = false;
  state.insuranceBet = 0;
  state.message = null;

  hand.cards.push(draw(state));
  state.dealer.push(draw(state));
  hand.cards.push(draw(state));
  state.dealer.push(draw(state));

  const dealerUpIsAce = state.dealer[0][0] === "A";
  const playerBJ = isBlackjack(hand.cards);

  if (dealerUpIsAce && !playerBJ) {
    state.insuranceOffered = true;
    state.phase = "player";
    return;
  }

  if (playerBJ || isBlackjack(state.dealer)) {
    hand.finished = true;
    state.phase = "dealer";
    resolveDealer(state);
    return;
  }

  state.phase = "player";
}

export function takeInsurance(state: BJState, accept: boolean) {
  if (!state.insuranceOffered) return;
  state.insuranceOffered = false;
  if (accept) {
    state.insuranceBet = Math.min(Math.floor(state.hands[0].bet / 2), state.bankroll);
    state.bankroll -= state.insuranceBet;
    state.insuranceTaken = true;
  }
  const hand = state.hands[0];
  if (isBlackjack(state.dealer)) {
    hand.finished = true;
    state.phase = "dealer";
    resolveDealer(state);
    return;
  }
  if (isBlackjack(hand.cards)) {
    hand.finished = true;
    state.phase = "dealer";
    resolveDealer(state);
    return;
  }
}

function activeHand(state: BJState): BJHand | undefined {
  return state.hands[state.active];
}

// Advances to the next unfinished hand, or into the dealer's turn once every
// hand is done (busted hands still need the dealer to "complete" the round
// visually/for bookkeeping, they just can't win).
function advance(state: BJState) {
  const hand = activeHand(state);
  if (hand) hand.finished = true;
  let next = state.active + 1;
  while (next < state.hands.length && state.hands[next].finished) next++;
  if (next < state.hands.length) {
    state.active = next;
    // a fresh split hand starting from one card needs its second card dealt
    const h = state.hands[next];
    if (h.cards.length === 1) h.cards.push(draw(state));
    if (h.splitAce || isBust(h.cards) || handValue(h.cards).total === 21) advance(state);
    return;
  }
  state.phase = "dealer";
  resolveDealer(state);
}

export function hit(state: BJState) {
  const hand = activeHand(state);
  if (!hand || hand.finished) return;
  hand.cards.push(draw(state));
  if (isBust(hand.cards) || handValue(hand.cards).total === 21) {
    advance(state);
  }
}

export function stand(state: BJState) {
  advance(state);
}

export function doubleDown(state: BJState) {
  const hand = activeHand(state);
  if (!hand || hand.finished || hand.cards.length !== 2 || hand.bet > state.bankroll) return;
  state.bankroll -= hand.bet;
  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(draw(state));
  advance(state);
}

export function canSplit(state: BJState): boolean {
  const hand = activeHand(state);
  if (!hand || hand.cards.length !== 2 || state.hands.length >= MAX_HANDS) return false;
  if (hand.bet > state.bankroll) return false;
  const va = RANK_VALUE[hand.cards[0][0] as Rank];
  const vb = RANK_VALUE[hand.cards[1][0] as Rank];
  return va === vb;
}

export function split(state: BJState) {
  const hand = activeHand(state);
  if (!canSplit(state)) return;
  const wasAces = hand!.cards[0][0] === "A";
  const secondCard = hand!.cards.pop()!;
  state.bankroll -= hand!.bet;
  const newHand: BJHand = {
    cards: [secondCard],
    bet: hand!.bet,
    doubled: false,
    finished: false,
    splitAce: wasAces,
    result: null,
  };
  hand!.splitAce = wasAces;
  state.hands.splice(state.active + 1, 0, newHand);
  hand!.cards.push(draw(state));
  if (wasAces || isBust(hand!.cards) || handValue(hand!.cards).total === 21) {
    advance(state);
  }
}

function resolveDealer(state: BJState) {
  state.dealerHidden = false;
  const anyLive = state.hands.some((h) => !isBust(h.cards));
  if (anyLive) {
    // dealer stands on all 17s (hard or soft) — the most common house rule
    while (handValue(state.dealer).total < 17) {
      state.dealer.push(draw(state));
    }
  }
  settle(state);
}

function settle(state: BJState) {
  const dealerBJ = isBlackjack(state.dealer) && state.dealer.length === 2;
  const dealerVal = handValue(state.dealer).total;
  const dealerBust = dealerVal > 21;

  if (state.insuranceTaken) {
    state.bankroll += dealerBJ ? state.insuranceBet * 3 : 0; // pays 2:1 + the bet back
  }

  for (const hand of state.hands) {
    const playerBJ = isBlackjack(hand.cards) && hand.cards.length === 2 && !hand.splitAce;
    const playerVal = handValue(hand.cards).total;
    const playerBust = playerVal > 21;

    if (playerBust) {
      hand.result = "lose";
    } else if (playerBJ && !dealerBJ) {
      hand.result = "blackjack";
      state.bankroll += Math.floor(hand.bet * 2.5); // original bet back + 3:2
    } else if (playerBJ && dealerBJ) {
      hand.result = "push";
      state.bankroll += hand.bet;
    } else if (dealerBJ) {
      hand.result = "lose";
    } else if (dealerBust || playerVal > dealerVal) {
      hand.result = "win";
      state.bankroll += hand.bet * 2;
    } else if (playerVal === dealerVal) {
      hand.result = "push";
      state.bankroll += hand.bet;
    } else {
      hand.result = "lose";
    }
  }

  state.phase = "settled";
  state.handsPlayed += 1;
  const net = state.hands.reduce((s, h) => {
    if (h.result === "win") return s + h.bet;
    if (h.result === "blackjack") return s + Math.floor(h.bet * 1.5);
    if (h.result === "lose") return s - h.bet;
    return s;
  }, 0) - (state.insuranceTaken && !dealerBJ ? state.insuranceBet : 0);
  state.message =
    net > 0 ? `+${net} fichas` : net < 0 ? `${net} fichas` : "Empate";
}

export function nextRound(state: BJState) {
  state.hands = [];
  state.dealer = [];
  state.dealerHidden = true;
  state.active = 0;
  state.insuranceOffered = false;
  state.insuranceTaken = false;
  state.insuranceBet = 0;
  state.message = null;
  state.phase = "betting";
  if (state.currentBet > state.bankroll) state.currentBet = Math.max(1, state.bankroll);
}
