"use client";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerRow, RoomRow } from "@/lib/types";
import { Seat } from "./Seat";
import { PlayingCard, CardSlot } from "./PlayingCard";
import { ChipStack } from "./Chip";

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
    <div className="relative w-full aspect-[3/2] max-w-5xl mx-auto drop-shadow-[0_25px_60px_rgba(0,0,0,0.75)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/table-bg.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
      />

      {/* center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
        <motion.div
          key={room.phase}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-[11px] tracking-[0.25em] uppercase text-amber-200/70 font-serif font-semibold"
        >
          {PHASE_LABEL[room.phase]}
        </motion.div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) =>
            room.community_cards[i] ? (
              <PlayingCard key={i} card={room.community_cards[i]} size="lg" delay={i * 0.22} />
            ) : (
              <CardSlot key={i} size="lg" />
            )
          )}
        </div>
        <AnimatePresence mode="wait">
          {room.pot > 0 && (
            <motion.div
              key={room.pot}
              initial={{ scale: 0.85, opacity: 0, y: 6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-1 flex items-center gap-2 bg-black/50 backdrop-blur px-4 py-1.5 rounded-full border border-amber-400/30"
            >
              <ChipStack amount={room.pot} size={16} />
              <span className="text-amber-200 font-mono font-bold">{room.pot.toLocaleString("pt-PT")}</span>
            </motion.div>
          )}
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
