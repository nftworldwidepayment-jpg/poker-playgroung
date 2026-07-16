export type Suit = "c" | "d" | "h" | "s";
export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "T" | "J" | "Q" | "K" | "A";

export type Card = `${Rank}${Suit}`;

export type RoomStatus = "waiting" | "playing" | "finished";
export type Phase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
export type PlayerStatus = "active" | "folded" | "all_in" | "sitting_out" | "left";

export interface RoomRow {
  id: string;
  code: string;
  status: RoomStatus;
  phase: Phase;
  small_blind: number;
  big_blind: number;
  dealer_seat: number | null;
  current_turn_seat: number | null;
  community_cards: Card[];
  pot: number;
  pots: { amount: number; eligible: string[] }[];
  current_bet: number;
  min_raise: number;
  deck: Card[];
  turn_expires_at: string | null;
  hand_number: number;
  max_players: number;
  last_action: { seat: number; name: string; action: string; amount?: number } | null;
  winners: { playerId: string; name: string; amount: number; hand?: string }[] | null;
  revealed_hands: { playerId: string; cards: Card[] }[] | null;
  created_at: string;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  seat: number;
  name: string;
  chips: number;
  current_bet: number;
  total_bet_hand: number;
  status: PlayerStatus;
  is_host: boolean;
  has_acted: boolean;
  is_connected: boolean;
  created_at: string;
}

export type PlayerAction = "fold" | "check" | "call" | "raise" | "all_in";
