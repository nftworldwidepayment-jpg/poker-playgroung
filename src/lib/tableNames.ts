const ADJECTIVES = [
  "Royal", "Midnight", "Golden", "Velvet", "High Roller", "Diamond", "Silent",
  "Copper", "Emerald", "Crimson", "Iron", "Marble", "Obsidian", "Amber",
];

const NOUNS = [
  "Table", "Salão", "Clube", "Cave", "Lounge", "Mesa", "Sala", "Suite", "Ring",
  "Estúdio", "Refúgio", "Terraço",
];

export function randomTableName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n}`;
}
