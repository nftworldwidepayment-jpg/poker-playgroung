"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RoomRow } from "@/lib/types";

interface Confetto {
  x: number;
  rotate: number;
  duration: number;
  delay: number;
}

export function WinnerOverlay({
  room,
  isHost,
  onNext,
  busy,
}: {
  room: RoomRow;
  isHost: boolean;
  onNext: () => void;
  busy: boolean;
}) {
  const winners = room.winners || [];
  const [confetti, setConfetti] = useState<Confetto[]>([]);

  useEffect(() => {
    setConfetti(
      Array.from({ length: 40 }).map(() => ({
        x: Math.random() * 100,
        rotate: Math.random() * 360,
        duration: 2.5 + Math.random() * 1.5,
        delay: Math.random() * 0.6,
      }))
    );
  }, [room.hand_number]);

  if (winners.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 overflow-hidden">
        {confetti.map((c, i) => (
          <motion.span
            key={i}
            initial={{ y: -20, x: `${c.x}%`, opacity: 1, rotate: 0 }}
            animate={{ y: "110vh", rotate: c.rotate }}
            transition={{ duration: c.duration, delay: c.delay, ease: "easeIn" }}
            className="absolute w-2 h-2 rounded-sm"
            style={{
              backgroundColor: ["#facc15", "#f472b6", "#34d399", "#60a5fa", "#f87171"][i % 5],
              top: 0,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 16 }}
        className="pointer-events-auto bg-gradient-to-br from-slate-900/95 to-slate-800/95 border border-amber-400/40 rounded-2xl px-8 py-6 shadow-2xl text-center max-w-sm mx-4"
      >
        <div className="text-amber-300 text-xs uppercase tracking-widest font-semibold mb-2">Mão terminada</div>
        {winners.map((w) => (
          <div key={w.playerId} className="mb-1">
            <div className="text-2xl font-extrabold text-white">{w.name}</div>
            <div className="text-amber-200 font-mono">
              +{w.amount.toLocaleString("pt-PT")} fichas
              {w.hand ? <span className="text-white/60 font-sans"> · {w.hand}</span> : null}
            </div>
          </div>
        ))}
        {isHost ? (
          <button
            disabled={busy}
            onClick={onNext}
            className="mt-4 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 transition font-bold text-slate-900 shadow-lg disabled:opacity-50"
          >
            Próxima mão
          </button>
        ) : (
          <div className="mt-4 text-white/50 text-sm">À espera do anfitrião...</div>
        )}
      </motion.div>
    </div>
  );
}
