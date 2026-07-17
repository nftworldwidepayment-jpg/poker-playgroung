"use client";
import { motion, AnimatePresence } from "framer-motion";
import { PlayerRow } from "@/lib/types";
import { PlayingCard } from "./PlayingCard";
import { ChipStack } from "./Chip";

const AVATAR_COLORS = [
  "from-fuchsia-500 to-purple-600",
  "from-cyan-400 to-blue-600",
  "from-amber-400 to-orange-600",
  "from-lime-400 to-emerald-600",
  "from-rose-400 to-red-600",
  "from-violet-400 to-indigo-600",
  "from-teal-400 to-cyan-600",
  "from-yellow-300 to-amber-600",
  "from-pink-400 to-fuchsia-600",
];

export function Seat({
  player,
  isYou,
  isTurn,
  isDealer,
  holeCards,
  showCards,
  timerPct,
  style,
  position,
  isThinking,
}: {
  player: PlayerRow;
  isYou: boolean;
  isTurn: boolean;
  isDealer: boolean;
  holeCards?: string[];
  showCards: boolean;
  timerPct: number;
  style: React.CSSProperties;
  position?: string | null;
  isThinking?: boolean;
}) {
  const folded = player.status === "folded";
  const allIn = player.status === "all_in";
  const color = AVATAR_COLORS[player.seat % AVATAR_COLORS.length];
  const cardCount = holeCards?.length || 2;

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5" style={style}>
      {isDealer && (
        <motion.div
          layoutId="dealer-button"
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-gradient-to-br from-white to-slate-200 text-[10px] font-serif font-bold text-slate-900 flex items-center justify-center shadow-[0_0_6px_rgba(0,0,0,0.4)] border-2 border-amber-400"
        >
          D
        </motion.div>
      )}
      {position && (
        <div className="absolute -top-2 -left-2 z-20 text-[9px] font-mono font-bold tracking-wide text-slate-900 bg-amber-200/90 rounded-full px-1.5 py-0.5 shadow">
          {position}
        </div>
      )}

      <div className={`flex gap-1 mb-1 ${isYou ? "h-28" : "h-20"}`}>
        {(holeCards || Array.from({ length: cardCount })).map((c, i) => (
          <PlayingCard
            key={i}
            card={c as string | undefined}
            hidden={!showCards}
            size={isYou ? "lg" : "md"}
            delay={i * 0.18}
          />
        ))}
      </div>

      <motion.div
        animate={
          isTurn
            ? {
                boxShadow: [
                  "0 0 0px rgba(250,204,21,0)",
                  "0 0 26px rgba(250,204,21,0.85)",
                  "0 0 0px rgba(250,204,21,0)",
                ],
              }
            : { boxShadow: "0 0 0px rgba(250,204,21,0)" }
        }
        transition={{ duration: 1.8, repeat: isTurn ? Infinity : 0, ease: "easeInOut" }}
        className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-lg border-2 ${
          isTurn ? "border-amber-300" : isYou ? "border-cyan-300/80" : "border-white/20"
        } ${folded ? "opacity-40 grayscale" : ""}`}
      >
        {player.name.slice(0, 2).toUpperCase()}
        {isTurn && (
          <svg className="absolute -inset-1" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="47"
              fill="none"
              stroke="rgba(250,204,21,0.9)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 47}
              strokeDashoffset={2 * Math.PI * 47 * (1 - timerPct)}
              transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dashoffset 0.4s linear" }}
            />
          </svg>
        )}
        {allIn && (
          <span className="absolute -bottom-2 px-1.5 py-0.5 rounded-full bg-rose-600 text-[9px] font-bold shadow">
            ALL-IN
          </span>
        )}
      </motion.div>

      <AnimatePresence>
        {isThinking && !isYou && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="absolute -top-6 flex items-center gap-0.5 bg-black/70 rounded-full px-2 py-1 border border-white/10"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1 h-1 rounded-full bg-amber-300"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center leading-tight bg-gradient-to-b from-black/50 to-black/30 border border-amber-400/10 rounded-full px-2.5 py-0.5 backdrop-blur-sm">
        <div className={`text-xs font-serif font-semibold ${isYou ? "text-cyan-300" : "text-amber-50/90"} max-w-[100px] truncate`}>
          {player.name} {isYou && "(tu)"}
        </div>
        <div className="text-[11px] text-amber-300 font-mono">{player.chips.toLocaleString("pt-PT")}</div>
      </div>

      {folded && (
        <div className="absolute top-9 text-[10px] font-bold text-rose-300 bg-black/70 px-2 py-0.5 rounded rotate-[-8deg] border border-rose-500/30">
          DESISTIU
        </div>
      )}

      <AnimatePresence>
        {player.current_bet > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.4, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.4, y: -8 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -bottom-8 flex items-center gap-1.5 bg-black/60 rounded-full pl-1 pr-2 py-0.5 border border-amber-400/30"
          >
            <ChipStack amount={player.current_bet} size={13} />
            <span className="text-[11px] font-mono text-amber-200">{player.current_bet}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
