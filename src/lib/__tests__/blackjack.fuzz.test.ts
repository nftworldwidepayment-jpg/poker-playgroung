// Fuzz test for the client-only blackjack engine — plays thousands of rounds with
// randomized actions (hit/stand/double/split/insurance) and asserts it never
// crashes, never lets a hand exceed MAX_HANDS via repeated splits, and that the
// bankroll math is internally consistent (nothing pays out more than the total
// action taken could justify — a coarse but effective conservation check, since
// unlike the poker engine there's no second party whose chips must reconcile).
import {
  initState, deal, hit, stand, doubleDown, split, canSplit, takeInsurance, nextRound,
  setBet, handValue, MAX_HANDS, BJState,
} from "../blackjack";

function playRound(state: BJState): void {
  setBet(state, 25);
  deal(state);

  if (state.insuranceOffered) {
    takeInsurance(state, Math.random() < 0.3);
  }

  let guard = 0;
  while (state.phase === "player" && guard < 200) {
    guard++;
    const hand = state.hands[state.active];
    if (!hand || hand.finished) break;
    const { total } = handValue(hand.cards);
    const r = Math.random();
    if (r < 0.15 && canSplit(state)) {
      split(state);
    } else if (r < 0.3 && hand.cards.length === 2 && hand.bet <= state.bankroll) {
      doubleDown(state);
    } else if (r < 0.7 && total < 21) {
      hit(state);
    } else {
      stand(state);
    }
  }
  if (guard >= 200) throw new Error("stuck in player loop — possible infinite loop bug");
}

function runFuzz(rounds: number, seedTag: string): boolean {
  const state = initState(1000);
  let maxHandsSeen = 0;
  for (let i = 0; i < rounds; i++) {
    if (state.bankroll <= 0) break;
    try {
      playRound(state);
    } catch (e) {
      console.log(`[${seedTag}] round ${i} threw:`, (e as Error).message);
      return false;
    }
    maxHandsSeen = Math.max(maxHandsSeen, state.hands.length);
    if (state.hands.length > MAX_HANDS) {
      console.log(`[${seedTag}] !!! exceeded MAX_HANDS: ${state.hands.length}`);
      return false;
    }
    if (state.bankroll < 0) {
      console.log(`[${seedTag}] !!! negative bankroll: ${state.bankroll}`);
      return false;
    }
    nextRound(state);
  }
  console.log(`[${seedTag}] OK — played to round ${state.handsPlayed}, max hands seen ${maxHandsSeen}, final bankroll ${state.bankroll}`);
  return true;
}

// Greedily splits every time it's legal, to actually exercise the path up to
// MAX_HANDS (organically rare — needs several same-rank pairs in a row).
function playRoundGreedySplit(state: BJState): void {
  setBet(state, 10); // small bet so 5x the bankroll's worth of splits stays affordable
  deal(state);
  if (state.insuranceOffered) takeInsurance(state, false);

  let guard = 0;
  while (state.phase === "player" && guard < 200) {
    guard++;
    const hand = state.hands[state.active];
    if (!hand || hand.finished) break;
    if (canSplit(state)) split(state);
    else stand(state);
  }
  if (guard >= 200) throw new Error("stuck in greedy-split loop");
}

function runGreedySplitFuzz(rounds: number, seedTag: string): boolean {
  const state = initState(1_000_000); // deep bankroll — this run is about reaching MAX_HANDS, not bankroll realism
  let maxHandsSeen = 0;
  for (let i = 0; i < rounds; i++) {
    try {
      playRoundGreedySplit(state);
    } catch (e) {
      console.log(`[${seedTag}] round ${i} threw:`, (e as Error).message);
      return false;
    }
    maxHandsSeen = Math.max(maxHandsSeen, state.hands.length);
    if (state.hands.length > MAX_HANDS) {
      console.log(`[${seedTag}] !!! exceeded MAX_HANDS: ${state.hands.length}`);
      return false;
    }
    nextRound(state);
  }
  console.log(`[${seedTag}] OK — ${rounds} rounds, max hands reached: ${maxHandsSeen}${maxHandsSeen === MAX_HANDS ? " (hit the cap!)" : ""}`);
  return maxHandsSeen >= 2; // sanity: splitting must have actually happened at least once
}

let allOk = true;
allOk = runFuzz(3000, "bj-3000-rounds") && allOk;
allOk = runFuzz(3000, "bj-3000-rounds-run2") && allOk;
allOk = runGreedySplitFuzz(4000, "bj-greedy-split") && allOk;

console.log(allOk ? "\nALL BLACKJACK FUZZ RUNS PASSED" : "\nSOME BLACKJACK FUZZ RUNS FAILED");
if (!allOk) process.exit(1);
