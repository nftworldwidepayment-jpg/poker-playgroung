// Avatar art ready for a future "choose your avatar" feature — not wired into
// the seat UI yet (seats currently show a colored initial), just catalogued
// here so picking it up later is a one-line job.
export const AVATAR_OPTIONS = [
  { id: "steampunk-man", label: "Relojoeiro", src: "/images/avatars/avatar-steampunk-man.webp" },
  { id: "old-man", label: "Veterano", src: "/images/avatars/avatar-old-man.webp" },
  { id: "wolf", label: "Lobo", src: "/images/avatars/avatar-wolf.webp" },
  { id: "raven", label: "Corvo", src: "/images/avatars/avatar-raven.webp" },
] as const;

export type AvatarId = (typeof AVATAR_OPTIONS)[number]["id"];

const AVATAR_KEY = "poker-avatar-key";

export function loadSavedAvatar(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

export function saveAvatar(id: string | null) {
  try {
    if (id) localStorage.setItem(AVATAR_KEY, id);
    else localStorage.removeItem(AVATAR_KEY);
  } catch {
    // ignore
  }
}

export function avatarSrc(id: string | null | undefined): string | null {
  if (!id) return null;
  return AVATAR_OPTIONS.find((a) => a.id === id)?.src ?? null;
}
