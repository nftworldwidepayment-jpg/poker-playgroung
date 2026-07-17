"use client";
import { motion } from "framer-motion";
import * as deck from "@letele/playing-cards";

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

const SIZES = {
  sm: "w-14",
  md: "w-20",
  lg: "w-28",
  xl: "w-32",
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
  const widthClass = SIZES[size];
  const Face = card ? (deck as Record<string, React.ComponentType<{ style?: React.CSSProperties }>>)[cardComponentKey(card)] : null;
  const Back = deck.B1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -46, rotate: -14, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 140, damping: 22, mass: 0.9 }}
      className={`relative ${widthClass} aspect-[5/7] rounded-[9%] [perspective:1000px] ${
        highlight ? "drop-shadow-[0_0_14px_rgba(251,191,36,0.75)]" : "drop-shadow-lg"
      }`}
    >
      <motion.div
        className="relative h-full w-full rounded-[9%] [transform-style:preserve-3d]"
        animate={{ rotateY: hidden ? 180 : 0 }}
        transition={{ duration: 0.85, ease: [0.45, 0, 0.15, 1], delay: delay > 0 ? delay * 0.4 : 0 }}
      >
        <div
          className={`absolute inset-0 overflow-hidden rounded-[9%] [backface-visibility:hidden] ${
            highlight ? "ring-2 ring-amber-400" : ""
          }`}
        >
          {Face && <Face style={{ width: "100%", height: "100%", display: "block" }} />}
        </div>
        <div className="absolute inset-0 overflow-hidden rounded-[9%] border border-amber-300/40 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <Back style={{ width: "100%", height: "100%", display: "block" }} />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, #6d28d9 0%, #a855f7 45%, #f59e0b 100%)",
              mixBlendMode: "color",
            }}
          />
          <div className="absolute inset-0" style={{ background: "rgba(20,10,30,0.25)", mixBlendMode: "multiply" }} />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CardSlot({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const widthClass = SIZES[size];
  return <div className={`${widthClass} aspect-[5/7] rounded-[9%] border border-dashed border-amber-200/15 bg-white/[0.03]`} />;
}
