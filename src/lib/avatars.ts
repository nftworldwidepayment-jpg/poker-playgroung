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
