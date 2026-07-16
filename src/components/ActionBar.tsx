"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PlayerRow, RoomRow } from "@/lib/types";

export function ActionBar({
  room,
  you,
  onAction,
  busy,
}: {
  room: RoomRow;
  you: PlayerRow;
  onAction: (action: string, amount?: number) => void;
  busy: boolean;
}) {
  const toCall = Math.min(room.current_bet - you.current_bet, you.chips);
  const canCheck = toCall <= 0;
  const minRaiseTo = room.current_bet + room.min_raise;

  let maxRaiseTo = you.chips + you.current_bet;
  if (room.game_type === "plo4") {
    const potAfterCall = room.pot + toCall;
    maxRaiseTo = Math.min(maxRaiseTo, room.current_bet + potAfterCall);
  }

  const clampedMin = Math.min(minRaiseTo, maxRaiseTo);
  const sliderDisabled = clampedMin >= maxRaiseTo;
  const [raiseTo, setRaiseTo] = useState(clampedMin);

  useEffect(() => {
    setRaiseTo(clampedMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.hand_number, room.phase, room.current_bet]);

  const potNow = room.pot + toCall;
  const quickBets = [
    { label: "½ pote", value: Math.round(room.current_bet + potNow / 2) },
    { label: "Pote", value: Math.round(room.current_bet + potNow) },
  ].filter((q) => q.value > clampedMin && q.value < maxRaiseTo);

  return (
    <motion.div
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black via-black/95 to-black/0 pt-12 pb-4 px-4"
    >
      <div className="max-w-xl mx-auto flex flex-col gap-3">
        {!sliderDisabled && maxRaiseTo > room.current_bet && (
          <div className="flex flex-col gap-2 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={clampedMin}
                max={maxRaiseTo}
                value={Math.min(Math.max(raiseTo, clampedMin), maxRaiseTo)}
                onChange={(e) => setRaiseTo(Number(e.target.value))}
                className="flex-1 accent-amber-400"
              />
              <span className="font-mono text-amber-300 w-16 text-right">{raiseTo}</span>
            </div>
            {quickBets.length > 0 && (
              <div className="flex gap-2">
                {quickBets.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => setRaiseTo(Math.min(q.value, maxRaiseTo))}
                    className="flex-1 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-amber-200/80 border border-white/10 transition"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => onAction("fold")}
            className="flex-1 py-3.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40"
          >
            Desistir
          </button>
          <button
            disabled={busy}
            onClick={() => onAction(canCheck ? "check" : "call")}
            className="flex-1 py-3.5 rounded-xl bg-sky-600/90 hover:bg-sky-600 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40"
          >
            {canCheck ? "Passar" : `Pagar ${toCall}`}
          </button>
          {!sliderDisabled && maxRaiseTo > room.current_bet && (
            <button
              disabled={busy}
              onClick={() => onAction("raise", Math.min(Math.max(raiseTo, clampedMin), maxRaiseTo))}
              className="flex-1 py-3.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40"
            >
              Subir
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => onAction("all_in")}
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40"
          >
            All-in
          </button>
        </div>
      </div>
    </motion.div>
  );
}
