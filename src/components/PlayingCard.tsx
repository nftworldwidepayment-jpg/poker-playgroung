"use client";
import { motion } from "framer-motion";

const SUIT_SYMBOL: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };
const SUIT_COLOR: Record<string, string> = {
  c: "text-slate-900",
  s: "text-slate-900",
  d: "text-rose-600",
  h: "text-rose-600",
};

export function PlayingCard({
  card,
  hidden,
  size = "md",
  delay = 0,
  highlight = false,
}: {
  card?: string;
  hidden?: boolean;
  size?: "sm" | "md" | "lg";
  delay?: number;
  highlight?: boolean;
}) {
  const dims = size === "sm" ? "w-8 h-11 text-xs" : size === "lg" ? "w-16 h-24 text-2xl" : "w-11 h-16 text-base";
  const rank = card?.[0];
  const suit = card?.[1];

  return (
    <motion.div
      initial={{ opacity: 0, y: -30, rotate: -8, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
      className={`relative ${dims} rounded-md shadow-lg [perspective:800px]`}
    >
      <motion.div
        className="relative h-full w-full rounded-md [transform-style:preserve-3d]"
        animate={{ rotateY: hidden ? 180 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* front */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center rounded-md border bg-white [backface-visibility:hidden] ${
            highlight ? "border-amber-400 ring-2 ring-amber-400 shadow-amber-400/50 shadow-lg" : "border-slate-300"
          }`}
        >
          {card && (
            <>
              <span className={`font-bold leading-none ${SUIT_COLOR[suit!]}`}>{rank}</span>
              <span className={`leading-none ${SUIT_COLOR[suit!]}`}>{SUIT_SYMBOL[suit!]}</span>
            </>
          )}
        </div>
        {/* back */}
        <div
          className="absolute inset-0 rounded-md border border-indigo-900 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            background:
              "repeating-linear-gradient(45deg, #4c1d95, #4c1d95 4px, #5b21b6 4px, #5b21b6 8px)",
          }}
        >
          <div className="absolute inset-1 rounded border border-amber-300/40" />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CardSlot({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "w-8 h-11" : size === "lg" ? "w-16 h-24" : "w-11 h-16";
  return <div className={`${dims} rounded-md border border-dashed border-white/10 bg-white/5`} />;
}
