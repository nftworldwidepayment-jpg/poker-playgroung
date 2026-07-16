"use client";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerRow, RoomRow } from "@/lib/types";
import { Seat } from "./Seat";
import { PlayingCard, CardSlot } from "./PlayingCard";

const PHASE_LABEL: Record<string, string> = {
  waiting: "À espera de jogadores",
  preflop: "Pré-Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

function seatPosition(index: number, total: number): React.CSSProperties {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const rx = 44;
  const ry = 40;
  const left = 50 + rx * Math.cos(angle);
  const top = 50 + ry * Math.sin(angle);
  return { left: `${left}%`, top: `${top}%` };
}

export function PokerTable({
  room,
  players,
  youId,
  holeCards,
  timerPct,
}: {
  room: RoomRow;
  players: PlayerRow[];
  youId: string | null;
  holeCards: string[];
  timerPct: number;
}) {
  const ordered = [...players].sort((a, b) => a.seat - b.seat);
  const total = Math.max(ordered.length, 1);

  return (
    <div className="relative w-full aspect-[16/10] max-w-4xl mx-auto">
      {/* table felt */}
      <div className="absolute inset-[6%] rounded-[50%] bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 shadow-[0_0_0_14px_#1c1410,0_0_60px_rgba(0,0,0,0.6),inset_0_0_80px_rgba(0,0,0,0.5)] border-4 border-amber-900/40">
        <div className="absolute inset-4 rounded-[50%] border border-emerald-400/10" />
        <div
          className="absolute inset-0 rounded-[50%] opacity-30"
          style={{
            background: "radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0.15), transparent 60%)",
          }}
        />
      </div>

      {/* center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
        <div className="text-[11px] tracking-widest uppercase text-amber-200/80 font-semibold">
          {PHASE_LABEL[room.phase]}
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) =>
            room.community_cards[i] ? (
              <PlayingCard key={i} card={room.community_cards[i]} size="lg" delay={i * 0.12} />
            ) : (
              <CardSlot key={i} size="lg" />
            )
          )}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={room.pot}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-1 flex items-center gap-2 bg-black/50 backdrop-blur px-4 py-1.5 rounded-full border border-amber-400/30"
          >
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border border-amber-100/60 shadow" />
            <span className="text-amber-200 font-mono font-bold">{room.pot.toLocaleString("pt-PT")}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* seats */}
      {ordered.map((p, i) => {
        const revealed = room.revealed_hands?.find((r) => r.playerId === p.id)?.cards;
        const isYou = p.id === youId;
        return (
          <Seat
            key={p.id}
            player={p}
            isYou={isYou}
            isTurn={room.current_turn_seat === p.seat}
            isDealer={room.dealer_seat === p.seat}
            holeCards={isYou ? holeCards : revealed}
            showCards={isYou || !!revealed}
            timerPct={timerPct}
            style={seatPosition(i, total)}
          />
        );
      })}
    </div>
  );
}
