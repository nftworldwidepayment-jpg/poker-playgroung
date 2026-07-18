// Public Supabase project values — see src/lib/supabaseClient.ts for why these are hardcoded fallbacks.
const FN_URL = process.env.NEXT_PUBLIC_POKER_FN_URL || "https://vsfmljbrqymbymiiyptx.supabase.co/functions/v1/poker";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZm1samJycXltYnltaWl5cHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzA0MzAsImV4cCI6MjA5OTgwNjQzMH0.3pyxF8gQMfKPQTDks91U_YplMkUWyiVN7wAuU_LzTWw";

async function call(op: string, body: Record<string, unknown> = {}) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ op, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro de rede");
  return data;
}

export interface Session {
  code: string;
  playerId: string;
  token: string;
  name: string;
  savedAt?: number;
}

export const api = {
  createRoom: (
    name: string,
    smallBlind: number,
    bigBlind: number,
    buyIn: number,
    gameType: string,
    runItTwiceEnabled = false
  ) =>
    call("create", { name, smallBlind, bigBlind, buyIn, gameType, runItTwiceEnabled }) as Promise<{
      code: string;
      playerId: string;
      token: string;
    }>,
  joinRoom: (code: string, name: string) =>
    call("join", { code, name }) as Promise<{ code: string; playerId: string; token: string }>,
  startHand: (code: string, playerId: string, token: string) =>
    call("start", { code, playerId, token }) as Promise<{ ok: boolean }>,
  action: (code: string, playerId: string, token: string, action: string, amount?: number) =>
    call("action", { code, playerId, token, action, amount }) as Promise<{ ok: boolean }>,
  timeout: (code: string) => call("timeout", { code }) as Promise<{ ok: boolean }>,
  hand: (code: string, playerId: string, token: string) =>
    call("hand", { code, playerId, token }) as Promise<{ cards: string[] }>,
  toggleStraddle: (playerId: string, token: string, enabled: boolean) =>
    call("toggle_straddle", { playerId, token, enabled }) as Promise<{ ok: boolean }>,
  toggleSitOut: (playerId: string, token: string, enabled: boolean) =>
    call("toggle_sit_out", { playerId, token, enabled }) as Promise<{ ok: boolean }>,
  toggleRunItTwice: (code: string, playerId: string, token: string, enabled: boolean) =>
    call("toggle_run_it_twice", { code, playerId, token, enabled }) as Promise<{ ok: boolean }>,
  showHand: (code: string, playerId: string, token: string) =>
    call("show_hand", { code, playerId, token }) as Promise<{ ok: boolean }>,
};

const STORAGE_KEY = "poker-session";

export function saveSession(s: Session) {
  localStorage.setItem(STORAGE_KEY + ":" + s.code, JSON.stringify({ ...s, savedAt: Date.now() }));
}

export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + ":" + code.toUpperCase());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Most recently joined/created room, across all rooms this browser has ever
// been in — powers the "Voltar à mesa" card on the lobby.
export function loadLatestSession(): Session | null {
  try {
    let best: Session | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_KEY + ":")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const s: Session = JSON.parse(raw);
      if (!best || (s.savedAt || 0) > (best.savedAt || 0)) best = s;
    }
    return best;
  } catch {
    return null;
  }
}
