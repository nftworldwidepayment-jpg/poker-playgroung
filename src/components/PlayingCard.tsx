"use client";
import { motion } from "framer-motion";

const SUIT_SYMBOL: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };
const SUIT_COLOR: Record<string, string> = {
  c: "text-slate-900",
  s: "text-slate-900",
  d: "text-rose-600",
  h: "text-rose-600",
};

const SIZES = {
  sm: { box: "w-11 h-16", rank: "text-sm", corner: "text-[9px]", watermark: "text-2xl" },
  md: { box: "w-16 h-24", rank: "text-lg", corner: "text-[11px]", watermark: "text-4xl" },
  lg: { box: "w-24 h-36", rank: "text-2xl", corner: "text-sm", watermark: "text-6xl" },
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
  size?: "sm" | "md" | "lg";
  delay?: number;
  highlight?: boolean;
}) {
  const dims = SIZES[size];
  const rank = card?.[0];
  const suit = card?.[1];
  const color = suit ? SUIT_COLOR[suit] : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: -46, rotate: -14, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 140, damping: 22, mass: 0.9 }}
      className={`relative ${dims.box} rounded-lg shadow-xl [perspective:1000px]`}
    >
      <motion.div
        className="relative h-full w-full rounded-lg [transform-style:preserve-3d]"
        animate={{ rotateY: hidden ? 180 : 0 }}
        transition={{ duration: 0.85, ease: [0.45, 0, 0.15, 1], delay: delay > 0 ? delay * 0.4 : 0 }}
      >
        {/* front */}
        <div
          className={`absolute inset-0 flex flex-col justify-between overflow-hidden rounded-lg border bg-gradient-to-br from-white to-slate-50 p-1.5 [backface-visibility:hidden] ${
            highlight
              ? "border-amber-400 ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.65)]"
              : "border-amber-200/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]"
          }`}
        >
          {card && (
            <>
              {/* watermark suit */}
              <span
                className={`pointer-events-none absolute inset-0 flex items-center justify-center ${dims.watermark} ${color} opacity-[0.09]`}
              >
                {SUIT_SYMBOL[suit!]}
              </span>
              {/* top-left index */}
              <div className={`relative z-10 flex flex-col items-center leading-none font-serif font-bold ${dims.corner} ${color}`}>
                <span className={dims.rank + " font-serif"}>{rank}</span>
                <span className="-mt-0.5">{SUIT_SYMBOL[suit!]}</span>
              </div>
              {/* bottom-right index (mirrored) */}
              <div
                className={`relative z-10 flex flex-col items-center self-end leading-none font-serif font-bold ${dims.corner} ${color} rotate-180`}
              >
                <span className={dims.rank + " font-serif"}>{rank}</span>
                <span className="-mt-0.5">{SUIT_SYMBOL[suit!]}</span>
              </div>
            </>
          )}
        </div>
        {/* back */}
        <div
          className="absolute inset-0 rounded-lg border border-amber-300/50 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, #241033 0%, #1b0c28 55%, #150920 100%)",
          }}
        >
          <div className="absolute inset-[3px] rounded-md border border-amber-300/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-[46%] w-[46%] items-center justify-center rounded-full border-2 border-amber-300/70 bg-gradient-to-br from-amber-300/20 to-transparent">
              <span className="font-serif text-amber-200/80" style={{ fontSize: "45%" }}>
                ♠
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CardSlot({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = SIZES[size];
  return <div className={`${dims.box} rounded-lg border border-dashed border-amber-200/15 bg-white/[0.03]`} />;
}
