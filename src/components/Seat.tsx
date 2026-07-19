"use client";
import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayerRow } from "@/lib/types";
import { PlayingCard } from "./PlayingCard";
import { ChipStack } from "./Chip";
import { CountUp } from "./CountUp";
import { useSettings } from "@/lib/settings";
import { avatarSrc } from "@/lib/avatars";
import { IconAlertCircle, IconBot, IconClose, IconCrown, IconFlame, IconFrown, IconSmile, IconThumbsUp } from "./icons";

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

// Only ever mounted for the one seat whose turn it currently is (see its call
// site below), so this is the only place in the whole app with a live timer
// interval at any moment — everything used to hang off a single 250ms tick in
// the room page that re-rendered the entire table (every seat, every card)
// four times a second for the whole hand. Isolating it here means a countdown
// tick now only ever touches this one small SVG.
function TurnRing({ turnExpiresAt, turnSeconds }: { turnExpiresAt: string | null; turnSeconds: number }) {
  const [pct, setPct] = useState(1);
  useEffect(() => {
    if (!turnExpiresAt) {
      setPct(1);
      return;
    }
    const seconds = turnSeconds || 30;
    function tick() {
      const remaining = (new Date(turnExpiresAt!).getTime() - Date.now()) / (seconds * 1000);
      setPct(Math.max(0, Math.min(1, remaining)));
    }
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [turnExpiresAt, turnSeconds]);

  return (
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
        strokeDashoffset={2 * Math.PI * 47 * (1 - pct)}
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset 0.2s linear" }}
      />
    </svg>
  );
}

function SeatImpl({
  player,
  isYou,
  isTurn,
  isDealer,
  holeCards,
  showCards,
  turnExpiresAt,
  turnSeconds,
  style,
  position,
  isThinking,
  equityPct,
  bigBlind,
  isDisconnected,
  noteDotColor,
  noteTitle,
  onNoteClick,
  emote,
  isHost,
  onKick,
  onSendEmote,
  isWinner,
}: {
  player: PlayerRow;
  isYou: boolean;
  isTurn: boolean;
  isDealer: boolean;
  holeCards?: string[];
  showCards: boolean;
  turnExpiresAt: string | null;
  turnSeconds: number;
  style: React.CSSProperties;
  position?: string | null;
  isThinking?: boolean;
  equityPct?: number;
  bigBlind: number;
  isDisconnected?: boolean;
  noteDotColor?: string | null;
  noteTitle?: string | null;
  onNoteClick?: () => void;
  emote?: string | null;
  isHost?: boolean;
  onKick?: () => void;
  onSendEmote?: (emoji: string) => void;
  isWinner?: boolean;
}) {
  const [settings] = useSettings();
  const avatarUrl = avatarSrc(player.avatar_key);
  const folded = player.status === "folded";
  const allIn = player.status === "all_in";
  const sittingOut = player.status === "sitting_out" && player.chips > 0;
  const color = AVATAR_COLORS[player.seat % AVATAR_COLORS.length];
  const cardCount = holeCards?.length || 2;

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={style}>
    {/* crowded tables (7-9 handed) shrink every seat uniformly via --seat-scale
        (set per-seat in PokerTable's seatPosition) so avatars/cards stop
        overlapping their neighbours — scaling this inner wrapper instead of
        the outer positioned div keeps the anchor point itself unmoved. */}
    <div className="flex flex-col items-center gap-1.5" style={{ transform: "scale(var(--seat-scale, 1))" }}>
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
      {isHost && !isYou && onKick && (
        <button
          onClick={onKick}
          title="Remover jogador (entre mãos)"
          className="absolute -top-2 right-6 z-20 w-5 h-5 rounded-full bg-rose-900/80 hover:bg-rose-700 border border-rose-400/40 text-rose-200 flex items-center justify-center"
        >
          <IconClose size={11} />
        </button>
      )}

      <AnimatePresence>
        {emote && EMOTE_ICONS[emote] && (
          <motion.div
            key={emote + Date.now()}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -50, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="absolute top-0 z-30 pointer-events-none text-amber-300"
          >
            {(() => {
              const Icon = EMOTE_ICONS[emote];
              return <Icon size={26} />;
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* items-start (not stretch) + no fixed height: the card's own aspect-[5/7] must
          win, or flex cross-axis stretch squashes it into whatever height happens to be here */}
      {!sittingOut && (
        <div className="flex gap-1.5 mb-1.5 items-start">
          {(holeCards || Array.from({ length: cardCount })).map((c, i) => (
            <div key={i} className={isYou ? "tilt-hover" : undefined}>
              <PlayingCard
                card={c as string | undefined}
                hidden={!showCards}
                size={isYou ? "xl" : "md"}
                delay={i * 0.18}
                highlight={isYou && showCards}
              />
            </div>
          ))}
        </div>
      )}

      <div
        className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-base sm:text-lg border-2 ${
          isTurn ? "border-amber-300 turn-glow" : isYou ? "border-cyan-300/80" : "border-white/20"
        } ${folded ? "opacity-40 grayscale" : ""} ${sittingOut ? "opacity-60 sitting-out-sepia" : ""} ${
          isWinner ? "win-glow" : ""
        } ${isYou && isTurn ? "thinking-breathe" : ""}`}
      >
        {player.is_host && (
          <span className="host-crown text-amber-300" title="Anfitrião da mesa">
            <IconCrown size={13} />
          </span>
        )}
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full select-none" draggable={false} />
        ) : (
          player.name.slice(0, 2).toUpperCase()
        )}
        {isTurn && <TurnRing turnExpiresAt={turnExpiresAt} turnSeconds={turnSeconds} />}
        {allIn && (
          <span className="absolute -bottom-2 px-1.5 py-0.5 rounded-full bg-rose-600 text-[9px] font-bold shadow">
            ALL-IN
          </span>
        )}
        {isDisconnected && !isYou && (
          <span
            className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-slate-500 border-2 border-slate-900 flex items-center justify-center"
            title="Desligado"
          >
            <span className="w-1 h-1 rounded-full bg-white/80" />
          </span>
        )}
      </div>

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

      <div
        onClick={!isYou ? onNoteClick : undefined}
        className={`text-center leading-tight bg-gradient-to-b from-black/50 to-black/30 border border-amber-400/10 rounded-full px-2.5 py-0.5 backdrop-blur-sm ${
          !isYou && onNoteClick ? "cursor-pointer hover:border-amber-400/30" : ""
        }`}
        title={!isYou ? noteTitle || "Clica para adicionar uma nota privada" : undefined}
      >
        <div className={`text-xs font-serif font-semibold ${isYou ? "text-cyan-300" : "text-amber-50/90"} max-w-[100px] truncate flex items-center justify-center gap-1`}>
          {noteDotColor && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${noteDotColor}`} />}
          {player.is_bot && (
            <span title={`Bot — ${player.bot_difficulty || "medium"}`} className="shrink-0">
              <IconBot size={12} />
            </span>
          )}
          {player.name} {isYou && "(tu)"}
        </div>
        <div className="text-[11px] text-amber-300 font-mono tabular-nums">
          {settings.bbDisplay ? (
            <>{(player.chips / bigBlind).toFixed(1)} BB</>
          ) : (
            <CountUp value={player.chips} />
          )}
        </div>
      </div>

      {equityPct != null && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-mono text-cyan-300 bg-black/50 rounded-full px-2 py-0.5 border border-cyan-400/20"
        >
          {equityPct}%
        </motion.div>
      )}

      {folded && (
        <div className="absolute top-9 text-[10px] font-bold text-rose-300 bg-black/70 px-2 py-0.5 rounded rotate-[-8deg] border border-rose-500/30">
          DESISTIU
        </div>
      )}

      {sittingOut && (
        <div className="absolute top-9 text-[10px] font-bold text-slate-300 bg-black/70 px-2 py-0.5 rounded border border-slate-500/30">
          DE FORA
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
            <span className="text-[11px] font-mono text-amber-200 tabular-nums">
              {settings.bbDisplay ? `${(player.current_bet / bigBlind).toFixed(1)}BB` : player.current_bet}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {isYou && onSendEmote && <EmoteTrigger onSend={onSendEmote} />}
    </div>
    </div>
  );
}

// Memoized: this seat's props stay referentially stable across the frequent
// Realtime updates that only touch other seats/pot state, so most seats skip
// re-rendering entirely on any given tick instead of the whole table redoing
// work every time anything in the room changes.
export const Seat = memo(SeatImpl);

// Keyed reactions instead of raw emoji characters — same feature (quick
// non-verbal reactions at the table), rendered with the app's own icon set
// instead of platform emoji glyphs.
const EMOTE_ICONS: Record<string, typeof IconThumbsUp> = {
  like: IconThumbsUp,
  wow: IconAlertCircle,
  fire: IconFlame,
  sad: IconFrown,
};
const QUICK_EMOTES = ["like", "wow", "fire", "sad"];

function EmoteTrigger({ onSend }: { onSend: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute -bottom-16 flex items-center gap-1">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex gap-1 bg-black/70 border border-white/10 rounded-full px-1.5 py-1"
          >
            {QUICK_EMOTES.map((key) => {
              const Icon = EMOTE_ICONS[key];
              return (
                <button
                  key={key}
                  onClick={() => {
                    onSend(key);
                    setOpen(false);
                  }}
                  className="p-1 text-amber-200/80 hover:text-amber-300 hover:scale-125 transition-transform"
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-6 h-6 rounded-full bg-black/50 border border-white/10 text-white/50 hover:text-white flex items-center justify-center"
        title="Enviar reação"
      >
        <IconSmile size={14} />
      </button>
    </div>
  );
}
