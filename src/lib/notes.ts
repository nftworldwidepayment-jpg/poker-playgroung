"use client";

// Private, local-only notes on opponents — never sent to the server, so they're
// visible only to the person who wrote them (like a physical notepad next to a
// live table). Keyed by room code since the same player id could theoretically
// reappear across different rooms/sessions on this browser.

export type NoteTag = "none" | "aggressive" | "passive" | "bluffer" | "tight";

export interface PlayerNote {
  tag: NoteTag;
  text: string;
}

export const TAG_META: Record<NoteTag, { label: string; color: string; dot: string }> = {
  none: { label: "Sem etiqueta", color: "text-white/40", dot: "bg-white/30" },
  aggressive: { label: "Agressivo", color: "text-rose-300", dot: "bg-rose-400" },
  passive: { label: "Passivo", color: "text-sky-300", dot: "bg-sky-400" },
  bluffer: { label: "Blefa muito", color: "text-fuchsia-300", dot: "bg-fuchsia-400" },
  tight: { label: "Fechado (tight)", color: "text-emerald-300", dot: "bg-emerald-400" },
};

function storageKey(code: string): string {
  return `poker-notes:${code.toUpperCase()}`;
}

export function loadNotes(code: string): Record<string, PlayerNote> {
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveNote(code: string, playerId: string, note: PlayerNote) {
  const all = loadNotes(code);
  if (!note.text.trim() && note.tag === "none") {
    delete all[playerId];
  } else {
    all[playerId] = note;
  }
  localStorage.setItem(storageKey(code), JSON.stringify(all));
}
