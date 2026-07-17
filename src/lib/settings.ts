"use client";
import { useEffect, useState } from "react";

// Player preferences, persisted locally per browser. Kept deliberately small and
// serialisable so it can move to per-account storage later without touching callers.
export interface Settings {
  sound: boolean;
  fourColorDeck: boolean;
  bbDisplay: boolean; // show stacks/bets in big blinds instead of chips
  fastMode: boolean; // 2x animation speed for grinders
  reducedMotion: boolean; // ambient/low-glare mode for long sessions
  handStrength: boolean; // show "you have: pair of queens" hint
}

const DEFAULTS: Settings = {
  sound: true,
  fourColorDeck: false,
  bbDisplay: false,
  fastMode: false,
  reducedMotion: false,
  handStrength: true,
};

const KEY = "poker-settings-v1";
const EVT = "poker-settings-change";

function read(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    setSettings(read());
    const onChange = () => setSettings(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...read(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    setSettings(next);
    window.dispatchEvent(new Event(EVT));
  }

  return [settings, update];
}
