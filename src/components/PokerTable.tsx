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

function RailStuds() {
  const studs = 22;
  return (
    <>
      {Array.from({ length: studs }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / studs;
        const rx = 49.3;
        const ry = 47.5;
        const left = 50 + rx * Math.cos(angle);
        const top = 50 + ry * Math.sin(angle);
        return (
          <div
            key={i}
            className="absolute w-[5px] h-[5px] rounded-full bg-gradient-to-br from-amber-200/70 to-amber-700/60 shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
            style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%,-50%)" }}
          />
        );
      })}
    </>
  );
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
    <div className="relative w-full aspect-[16/10] max-w-5xl mx-auto">
      {/* outer leather rail */}
      <div
        className="absolute inset-0 rounded-[50%]"
        style={{
          background: "radial-gradient(ellipse at 35% 25%, #4a2f1c 0%, #2c1a10 45%, #170d08 100%)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7), inset 0 2px 4px rgba(255,255,255,0.08)",
        }}
      >
        <div
          className="absolute inset-[1.2%] rounded-[50%] opacity-70"
          style={{
            background:
              "repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 3px, rgba(0,0,0,0.15) 4px)",
          }}
        />
        <RailStuds />
      </div>

      {/* felt */}
      <div className="absolute inset-[6.5%] rounded-[50%] bg-gradient-to-br from-[#0c2a24] via-[#0a1f2b] to-[#060f1a] shadow-[inset_0_0_90px_rgba(0,0,0,0.65),inset_0_0_0_2px_rgba(212,175,90,0.25)] border border-amber-900/20 overflow-hidden">
        {/* stitching */}
        <div className="absolute inset-3 rounded-[50%] border border-dashed border-amber-300/10" />
        {/* subtle felt grain */}
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #fff 0px, transparent 1px, transparent 2px), repeating-linear-gradient(90deg, #fff 0px, transparent 1px, transparent 2px)",
          }}
        />
        {/* specular light from top */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: "radial-gradient(ellipse 60% 45% at 50% 8%, rgba(255,255,255,0.16), transparent 65%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: "radial-gradient(ellipse 90% 70% at 50% 105%, rgba(0,0,0,0.5), transparent 60%)",
          }}
        />

        {/* center crest logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <div className="flex flex-col items-center gap-1 opacity-[0.16]">
            <span className="text-amber-200 text-2xl">♠</span>
            <span className="font-serif font-bold tracking-[0.3em] text-amber-100 text-sm">POKER NIGHT</span>
          </div>
        </div>
      </div>

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
