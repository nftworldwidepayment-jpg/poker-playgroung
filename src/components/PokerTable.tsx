"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerRow, RoomRow } from "@/lib/types";
import { Seat } from "./Seat";
import { PlayingCard, CardSlot } from "./PlayingCard";
import { ChipStack } from "./Chip";
import { CountUp } from "./CountUp";

const CARD_REVEAL_MS = 650;

// Reveals community cards one at a time, at a fixed pace, even when the server
// hands us several at once (e.g. an all-in run-out resolves flop+turn+river
// in a single update) — this is what makes "everyone's all-in" hands feel
// like they're actually being dealt instead of just appearing.
function useStaggeredBoard(room: RoomRow) {
  const [visibleCount, setVisibleCount] = useState(room.community_cards.length);
  const handRef = useRef(room.hand_number);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (room.hand_number !== handRef.current) {
      handRef.current = room.hand_number;
      setVisibleCount(0);
    }
  }, [room.hand_number]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const target = room.community_cards.length;
    function tick() {
      setVisibleCount((v) => {
        if (v >= target) return v;
        timerRef.current = setTimeout(tick, CARD_REVEAL_MS);
        return v + 1;
      });
    }
    setVisibleCount((v) => {
      if (v < target) timerRef.current = setTimeout(tick, CARD_REVEAL_MS);
      return v;
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [room.community_cards.length, room.hand_number]);

  return Math.min(visibleCount, room.community_cards.length);
}

const PHASE_LABEL: Record<string, string> = {
  waiting: "À espera de jogadores",
  preflop: "Pré-Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

// index 0 always sits at the bottom-center (angle = +90deg), wrapping clockwise from there —
// callers pass a seat index already rotated so that "you" is index 0, keeping your own seat
// facing the camera no matter which physical seat number you're sitting in.
function seatPosition(index: number, total: number): React.CSSProperties {
  const angle = (Math.PI * 2 * index) / total + Math.PI / 2;
  const rx = 44;
  const ry = 40;
  const left = 50 + rx * Math.cos(angle);
  const top = 50 + ry * Math.sin(angle);
  return { left: `${left}%`, top: `${top}%` };
}

function positionLabel(seat: number, dealerSeat: number | null, total: number): string | null {
  if (dealerSeat == null || total < 2) return null;
  const offset = (seat - dealerSeat + total) % total;
  if (total === 2) return offset === 0 ? "BTN" : "BB";
  if (offset === 0) return "BTN";
  if (offset === 1) return "SB";
  if (offset === 2) return "BB";
  if (offset === 3) return "UTG";
  if (offset === total - 1) return "CO";
  if (offset === total - 2) return "HJ";
  return null;
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
  const visibleBoard = useStaggeredBoard(room);
  const youIdx = Math.max(0, ordered.findIndex((p) => p.id === youId));

  return (
    <div className="relative w-full aspect-[3/2] max-w-5xl mx-auto drop-shadow-[0_25px_60px_rgba(0,0,0,0.75)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/table-bg.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
      />
      {/* felt lighting: soft light pooling at the center, subtle grain, matching a real table's spotlight */}
      <div
        className="absolute inset-[8%] rounded-[45%] pointer-events-none mix-blend-soft-light opacity-70"
        style={{ background: "radial-gradient(ellipse 60% 55% at 50% 42%, rgba(255,246,220,0.35), transparent 70%)" }}
      />
      <div
        className="absolute inset-[8%] rounded-[45%] pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
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
            i < visibleBoard ? (
              <PlayingCard key={i} card={room.community_cards[i]} size="lg" delay={0} />
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
              className="mt-1 flex flex-col items-center gap-1"
            >
              <div className="relative flex items-center gap-2 bg-black/50 backdrop-blur px-4 py-1.5 rounded-full border border-amber-400/30">
                <motion.div
                  className="absolute inset-0 rounded-full border border-amber-300/40"
                  animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.18, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <ChipStack amount={room.pot} size={16} />
                <CountUp value={room.pot} className="text-amber-200 font-mono font-bold tabular-nums" />
              </div>
              {room.pots.length > 1 ? (
                <div className="flex gap-1.5">
                  {room.pots.map((p, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-mono text-amber-200/60 bg-black/40 border border-amber-400/15 rounded-full px-2 py-0.5 tabular-nums"
                    >
                      {i === 0 ? "Pote" : `Lateral ${i}`} {p.amount.toLocaleString("pt-PT")}
                    </span>
                  ))}
                </div>
              ) : (
                room.phase === "preflop" && (
                  <span className="text-[9px] font-mono text-amber-200/40 tabular-nums">
                    SB {room.small_blind} + BB {room.big_blind}
                    {room.pot > room.small_blind + room.big_blind ? " + apostas" : ""}
                  </span>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* seats — rotated so your own seat always renders at the bottom, facing you.
          Your own cards render large and face-up right at your seat (no separate
          duplicate panel — that used to collide with the seat's avatar/nameplate). */}
      {ordered.map((p, i) => {
        const revealed = room.revealed_hands?.find((r) => r.playerId === p.id)?.cards;
        const isYou = p.id === youId;
        const isThinking =
          room.current_turn_seat === p.seat && p.status === "active" && room.phase !== "showdown";
        const rel = (i - youIdx + total) % total;
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
            style={seatPosition(rel, total)}
            position={positionLabel(p.seat, room.dealer_seat, total)}
            isThinking={isThinking}
            equityPct={room.all_in_equity?.find((e) => e.playerId === p.id)?.pct}
            bigBlind={room.big_blind}
          />
        );
      })}
    </div>
  );
}
