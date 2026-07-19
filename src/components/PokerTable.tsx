"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerRow, RoomRow } from "@/lib/types";
import { Seat } from "./Seat";
import { PlayingCard, CardSlot } from "./PlayingCard";
import { ChipStack } from "./Chip";
import { CountUp } from "./CountUp";
import { useSettings } from "@/lib/settings";

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
  const rx = 40;
  // taller than rx on purpose: each seat's own card/avatar/name column extends
  // well above its anchor point, so it needs more clearance from the vertical
  // center (community cards + pot) than it does from the left/right edges.
  const ry = 46;
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
  connectedIds,
  noteDots,
  noteTitles,
  onNoteClick,
  emotes,
  onSendEmote,
  isHost,
  onKick,
}: {
  room: RoomRow;
  players: PlayerRow[];
  youId: string | null;
  holeCards: string[];
  connectedIds?: Set<string>;
  noteDots?: Record<string, string>;
  noteTitles?: Record<string, string>;
  onNoteClick?: (playerId: string) => void;
  emotes?: { id: number; playerId: string; emoji: string }[];
  onSendEmote?: (playerId: string, emoji: string) => void;
  isHost?: boolean;
  onKick?: (playerId: string) => void;
}) {
  const ordered = [...players].sort((a, b) => a.seat - b.seat);
  const total = Math.max(ordered.length, 1);
  // stable per-index style objects — seatPosition(i, total) is pure, but calling it
  // inline in the render loop below would hand every Seat a brand-new object every
  // render regardless of memoization, since object identity never matches by
  // reference even when the numbers are the same.
  const seatStyles = useMemo(
    () => Array.from({ length: total }, (_, i) => seatPosition(i, total)),
    [total]
  );
  const visibleBoard = useStaggeredBoard(room);
  const youIdx = Math.max(0, ordered.findIndex((p) => p.id === youId));
  const [settings] = useSettings();
  const allInKey = `${room.hand_number}:${ordered.filter((p) => p.status === "all_in").map((p) => p.id).join(",")}`;
  const seenAllInKey = useRef<string | null>(null);
  const [showAllInVignette, setShowAllInVignette] = useState(false);
  useEffect(() => {
    const hasAllIn = ordered.some((p) => p.status === "all_in");
    if (hasAllIn && seenAllInKey.current !== allInKey && !settings.reducedMotion) {
      seenAllInKey.current = allInKey;
      setShowAllInVignette(true);
      const t = setTimeout(() => setShowAllInVignette(false), 2200);
      return () => clearTimeout(t);
    }
    seenAllInKey.current = allInKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allInKey]);

  return (
    <div className="relative w-full aspect-[3/4] sm:aspect-[3/2] max-w-5xl mx-auto drop-shadow-[0_25px_60px_rgba(0,0,0,0.75)] felt-texture">
      {showAllInVignette && <div className="allin-vignette" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/table-bg.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
      />
      {/* felt lighting: soft light pooling at the center, subtle grain, matching a real table's spotlight
          (dimmed under "modo ambiente" for long sessions) */}
      <div
        className={`absolute inset-[8%] rounded-[45%] pointer-events-none mix-blend-soft-light ${
          settings.reducedMotion ? "opacity-35" : "opacity-70"
        }`}
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
        <div className="flex gap-1 sm:gap-2">
          {Array.from({ length: 5 }).map((_, i) => {
            if (i < visibleBoard) return <PlayingCard key={i} card={room.community_cards[i]} size="lg" delay={0} />;
            // Rabbit hunt: after a fold-win, preview the cards that would have come —
            // rendered ghosted directly in the remaining board slots, not just in the popup.
            const rabbitIdx = i - room.community_cards.length;
            const rabbitCard = room.rabbit_cards?.[rabbitIdx];
            if (rabbitCard) {
              return (
                <div key={i} className="relative opacity-60 grayscale-[30%]">
                  <PlayingCard card={rabbitCard} size="lg" delay={0} />
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[7px] uppercase tracking-wider text-amber-200/50 whitespace-nowrap">
                    rabbit
                  </div>
                </div>
              );
            }
            return <CardSlot key={i} size="lg" />;
          })}
        </div>
        {room.rabbit_cards && room.rabbit_cards.length > 0 && (
          <div className="text-[9px] uppercase tracking-widest text-amber-200/40 -mt-1">
            Rabbit hunt · e se tivesse continuado?
          </div>
        )}
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
                {!settings.reducedMotion && (
                  <motion.div
                    className="absolute inset-0 rounded-full border border-amber-300/40"
                    animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.18, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
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
        const activeEmote = emotes?.filter((e) => e.playerId === p.id).slice(-1)[0];
        return (
          <Seat
            key={p.id}
            player={p}
            isYou={isYou}
            isTurn={room.current_turn_seat === p.seat}
            isDealer={room.dealer_seat === p.seat}
            holeCards={isYou ? holeCards : revealed}
            showCards={isYou || !!revealed}
            turnExpiresAt={room.turn_expires_at}
            turnSeconds={room.turn_seconds}
            style={seatStyles[rel]}
            position={positionLabel(p.seat, room.dealer_seat, total)}
            isThinking={isThinking}
            equityPct={room.all_in_equity?.find((e) => e.playerId === p.id)?.pct}
            bigBlind={room.big_blind}
            isDisconnected={!!connectedIds && connectedIds.size > 0 && p.status !== "left" && !connectedIds.has(p.id)}
            noteDotColor={noteDots?.[p.id]}
            noteTitle={noteTitles?.[p.id]}
            onNoteClick={onNoteClick ? () => onNoteClick(p.id) : undefined}
            emote={activeEmote?.emoji}
            onSendEmote={onSendEmote ? (emoji) => onSendEmote(p.id, emoji) : undefined}
            isHost={isHost}
            onKick={onKick ? () => onKick(p.id) : undefined}
            isWinner={room.phase === "showdown" && !!room.winners?.some((w) => w.playerId === p.id)}
          />
        );
      })}
    </div>
  );
}
