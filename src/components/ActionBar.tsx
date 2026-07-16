"use client";
import { useState } from "react";
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
  const maxRaiseTo = you.chips + you.current_bet;
  const [raiseTo, setRaiseTo] = useState(Math.min(minRaiseTo, maxRaiseTo));

  const clampedMin = Math.min(minRaiseTo, maxRaiseTo);
  const sliderDisabled = clampedMin >= maxRaiseTo;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black via-black/95 to-black/0 pt-10 pb-4 px-4"
    >
      <div className="max-w-xl mx-auto flex flex-col gap-3">
        {!sliderDisabled && maxRaiseTo > room.current_bet && (
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/10">
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
        )}
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => onAction("fold")}
            className="flex-1 py-3 rounded-xl bg-rose-600/90 hover:bg-rose-600 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40"
          >
            Desistir
          </button>
          <button
            disabled={busy}
            onClick={() => onAction(canCheck ? "check" : "call")}
            className="flex-1 py-3 rounded-xl bg-sky-600/90 hover:bg-sky-600 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40"
          >
            {canCheck ? "Passar" : `Pagar ${toCall}`}
          </button>
          {!sliderDisabled && maxRaiseTo > room.current_bet && (
            <button
              disabled={busy}
              onClick={() => onAction("raise", Math.min(Math.max(raiseTo, clampedMin), maxRaiseTo))}
              className="flex-1 py-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40"
            >
              Subir
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => onAction("all_in")}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40"
          >
            All-in
          </button>
        </div>
      </div>
    </motion.div>
  );
}
