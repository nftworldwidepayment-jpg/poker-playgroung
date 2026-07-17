import { Card, GameType } from "./types";
import { evaluate7, evaluateOmaha } from "./cards";

// A short, human label for the hero's current made hand (e.g. "Par de Damas"),
// shown as a subtle on-table hint. Purely cosmetic / client-side.
export function handStrengthLabel(
  hole: string[],
  board: Card[],
  gameType: GameType
): string | null {
  if (!hole.length || board.length < 3) return null;
  try {
    const ev =
      gameType === "plo4"
        ? evaluateOmaha(hole as Card[], board)
        : evaluate7([...(hole as Card[]), ...board]);
    return ev.name;
  } catch {
    return null;
  }
}
