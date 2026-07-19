"use client";
import { motion } from "framer-motion";
import * as deck from "@letele/playing-cards";
import { useSettings } from "@/lib/settings";

// Global colour-remap filters for the four-colour deck, mounted once near the app root.
// Diamonds swap red↔blue channels (red ink → blue, white/black untouched); clubs map
// black ink → green via a per-channel ramp. Spades/hearts keep the classic look.
export function DeckFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden style={{ position: "absolute" }}>
      <defs>
        <filter id="fc-diamond" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0 1 0 0
                    0 1 0 0 0
                    1 0 0 0 0
                    0 0 0 1 0"
          />
        </filter>
        <filter id="fc-club" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1   0    0   0 0
                    0   0.45 0   0 0.55
                    0   0    0.7 0 0.3
                    0   0    0   1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}

const RANK_KEY: Record<string, string> = {
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  T: "10",
  J: "j",
  Q: "q",
  K: "k",
  A: "a",
};
const SUIT_KEY: Record<string, string> = { c: "C", d: "D", h: "H", s: "S" };

function cardComponentKey(card: string): string {
  const rank = card[0];
  const suit = card[1];
  return `${SUIT_KEY[suit]}${RANK_KEY[rank]}`;
}

// Smaller by default, full size from the sm breakpoint (640px) up — on a narrow
// phone in portrait, opponent seats sit close enough to the table's sides that
// full-size fixed-width cards were spilling past the felt image's own edges.
const SIZES = {
  sm: "w-10 sm:w-14",
  md: "w-14 sm:w-20",
  lg: "w-16 sm:w-28",
  xl: "w-20 sm:w-32",
} as const;

export function PlayingCard({
  card,
  hidden,
  size = "md",
  delay = 0,
  highlight = false,
}: {
  card?: string;
  hidden?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  delay?: number;
  highlight?: boolean;
}) {
  const [settings] = useSettings();
  const widthClass = SIZES[size];
  const Face = card
    ? (deck as Record<string, React.ComponentType<{ style?: React.CSSProperties; preserveAspectRatio?: string }>>)[
        cardComponentKey(card)
      ]
    : null;

  const suit = card?.[1];
  let faceFilter: string | undefined;
  if (settings.fourColorDeck && suit === "d") faceFilter = "url(#fc-diamond)";
  else if (settings.fourColorDeck && suit === "c") faceFilter = "url(#fc-club)";

  const flipDur = settings.fastMode ? 0.45 : 0.85;

  return (
    <motion.div
      initial={{ opacity: 0, y: -46, rotate: -14, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 140, damping: 22, mass: 0.9 }}
      className={`relative ${widthClass} aspect-[5/7] rounded-[9%] [perspective:1000px] ${
        highlight ? "drop-shadow-[0_0_16px_rgba(201,169,97,0.8)]" : "drop-shadow-lg"
      }`}
    >
      <motion.div
        className="relative h-full w-full rounded-[9%] [transform-style:preserve-3d]"
        animate={{ rotateY: hidden ? 180 : 0 }}
        transition={{ duration: flipDur, ease: [0.45, 0, 0.15, 1], delay: delay > 0 ? delay * 0.4 : 0 }}
      >
        <div
          className={`absolute inset-0 overflow-hidden rounded-[9%] [backface-visibility:hidden] ${
            highlight ? "ring-2 ring-[var(--gold)]" : ""
          }`}
        >
          {Face && (
            <Face
              preserveAspectRatio="xMidYMid slice"
              style={{ width: "100%", height: "100%", display: "block", filter: faceFilter }}
            />
          )}
        </div>
        <div className="absolute inset-0 overflow-hidden rounded-[9%] border border-[var(--gold)]/40 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/card-back.webp" alt="" draggable={false} className="w-full h-full object-cover select-none" />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CardSlot({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const widthClass = SIZES[size];
  return <div className={`${widthClass} aspect-[5/7] rounded-[9%] border border-dashed border-amber-200/15 bg-white/[0.03]`} />;
}
