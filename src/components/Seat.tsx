"use client";
import { motion, AnimatePresence } from "framer-motion";
import { PlayerRow } from "@/lib/types";
import { PlayingCard } from "./PlayingCard";

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
}: {
  player: PlayerRow;
  isYou: boolean;
  isTurn: boolean;
  isDealer: boolean;
  holeCards?: string[];
  showCards: boolean;
  timerPct: number;
  style: React.CSSProperties;
}) {
  const folded = player.status === "folded";
  const allIn = player.status === "all_in";
  const color = AVATAR_COLORS[player.seat % AVATAR_COLORS.length];

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1" style={style}>
      {isDealer && (
        <div className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-white text-[10px] font-bold text-slate-900 flex items-center justify-center shadow-md border border-amber-400">
          D
        </div>
      )}

      <div className="flex gap-0.5 mb-1 h-11">
        {(holeCards || [undefined, undefined]).map((c, i) => (
          <PlayingCard key={i} card={c} hidden={!showCards} size="sm" delay={i * 0.08} />
        ))}
      </div>

      <motion.div
        animate={
          isTurn
            ? { boxShadow: ["0 0 0px rgba(250,204,21,0)", "0 0 22px rgba(250,204,21,0.9)", "0 0 0px rgba(250,204,21,0)"] }
            : { boxShadow: "0 0 0px rgba(250,204,21,0)" }
        }
        transition={{ duration: 1.1, repeat: isTurn ? Infinity : 0 }}
        className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-lg border-2 ${
          isTurn ? "border-amber-300" : isYou ? "border-cyan-300" : "border-white/20"
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
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>
        )}
        {allIn && (
          <span className="absolute -bottom-2 px-1.5 py-0.5 rounded-full bg-rose-600 text-[9px] font-bold shadow">
            ALL-IN
          </span>
        )}
      </motion.div>

      <div className="text-center leading-tight">
        <div className={`text-xs font-semibold ${isYou ? "text-cyan-300" : "text-white"} max-w-[90px] truncate`}>
          {player.name} {isYou && "(tu)"}
        </div>
        <div className="text-[11px] text-amber-300 font-mono">{player.chips.toLocaleString("pt-PT")}</div>
      </div>

      {folded && (
        <div className="absolute top-8 text-[10px] font-bold text-rose-400 bg-black/60 px-2 py-0.5 rounded rotate-[-8deg]">
          DESISTIU
        </div>
      )}

      <AnimatePresence>
        {player.current_bet > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute -bottom-7 flex items-center gap-1 bg-black/70 rounded-full px-2 py-0.5 border border-amber-400/40"
          >
            <span className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border border-amber-100/60" />
            <span className="text-[11px] font-mono text-amber-200">{player.current_bet}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
