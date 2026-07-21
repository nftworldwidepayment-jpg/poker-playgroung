export type Suit = "c" | "d" | "h" | "s";
export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "T" | "J" | "Q" | "K" | "A";

export type Card = `${Rank}${Suit}`;

export type RoomStatus = "waiting" | "playing" | "finished" | "paused";
export type Phase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
export type PlayerStatus = "active" | "folded" | "all_in" | "sitting_out" | "left";
export type GameType = "nlhe" | "plo4";

export interface LastHandSnapshot {
  handNumber: number;
  board: Card[];
  winners: { playerId: string; name: string; amount: number; hand?: string }[];
  revealedHands: { playerId: string; cards: Card[] }[] | null;
}

export interface RoomRow {
  id: string;
  code: string;
  status: RoomStatus;
  phase: Phase;
  game_type: GameType;
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
  rabbit_cards: Card[] | null;
  rabbit_hunt_enabled: boolean;
  run_it_twice_enabled: boolean;
  run_it_twice_boards: Card[][] | null;
  last_hand: LastHandSnapshot | null;
  all_in_equity: { playerId: string; pct: number }[] | null;
  ante: number;
  turn_seconds: number;
  allow_straddle: boolean;
  is_private: boolean;
  table_name: string | null;
  paused_at: string | null;
  buy_in: number;
  tourney_enabled: boolean;
  tourney_started_at: string | null;
  level_minutes: number;
  blind_level: number;
  base_small_blind: number | null;
  base_big_blind: number | null;
  finish_order: { playerId: string; name: string; place: number }[] | null;
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
  auto_straddle: boolean;
  wants_sit_out: boolean;
  avatar_key: string | null;
  last_action_at: string | null;
  left_at: string | null;
  consecutive_timeouts: number;
  is_bot: boolean;
  bot_difficulty: "easy" | "medium" | "hard" | null;
}

export type PlayerAction = "fold" | "check" | "call" | "raise" | "all_in";
