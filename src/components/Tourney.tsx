"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RoomRow } from "@/lib/types";
import { tourneyLevelBlinds } from "@/lib/engine";
import { IconCrown } from "./icons";

// Pill de estado do torneio no header da sala: nível atual, blinds, e quanto
// falta para a próxima subida. O nível REAL só muda na próxima mão (regra do
// motor), mas o countdown dá a antecipação certa: "as blinds vão dobrar já já".
export function TourneyStatus({ room }: { room: RoomRow }) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!room.tourney_started_at || room.status === "finished") return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [room.tourney_started_at, room.status]);

  if (!room.tourney_enabled) return null;

  if (!room.tourney_started_at) {
    return (
      <span className="text-[10px] uppercase tracking-widest text-amber-300/60 font-serif border border-amber-400/20 rounded-full px-2 py-1">
        Torneio
      </span>
    );
  }

  const levelMs = (room.level_minutes > 0 ? room.level_minutes : 10) * 60_000;
  const elapsed = Date.now() - new Date(room.tourney_started_at).getTime();
  const clockLevel = Math.max(0, Math.floor(elapsed / levelMs));
  const msIntoLevel = elapsed - clockLevel * levelMs;
  const remainMs = Math.max(0, levelMs - msIntoLevel);
  const mm = Math.floor(remainMs / 60_000);
  const ss = Math.floor((remainMs % 60_000) / 1000);
  const baseSb = room.base_small_blind ?? room.small_blind;
  const next = tourneyLevelBlinds(baseSb, clockLevel + 1);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] text-amber-200/80 font-mono border border-amber-400/20 rounded-full px-2.5 py-1"
      title={`Próximo nível: ${next.sb}/${next.bb}`}
    >
      <span className="uppercase tracking-wider font-sans font-semibold text-amber-300/70">
        Nv {room.blind_level + 1}
      </span>
      <span className="text-white/25">·</span>
      <span>
        {room.small_blind}/{room.big_blind}
      </span>
      {room.status !== "finished" && (
        <>
          <span className="text-white/25">·</span>
          <span className="tabular-nums text-white/50">
            {mm}:{String(ss).padStart(2, "0")}
          </span>
        </>
      )}
    </span>
  );
}

const PLACE_STYLE: Record<number, { ring: string; label: string }> = {
  1: { ring: "border-[var(--gold-bright)] text-[var(--gold-bright)]", label: "Campeão" },
  2: { ring: "border-slate-300/70 text-slate-300", label: "2º lugar" },
  3: { ring: "border-amber-700/70 text-amber-600", label: "3º lugar" },
};

// Ecrã final do torneio: pódio com a classificação completa. Substitui o
// WinnerOverlay da última mão — o momento é "acabou o torneio", não "acabou
// uma mão".
export function TourneyPodium({ room, youId }: { room: RoomRow; youId: string | null }) {
  const order = [...(room.finish_order || [])].sort((a, b) => a.place - b.place);
  if (order.length === 0) return null;
  const champion = order[0];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
        className="relative bg-[var(--bg-raised)]/95 border border-amber-400/30 rounded-3xl px-7 py-6 shadow-2xl text-center w-full max-w-sm"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.15 }}
          className="text-[var(--gold-bright)] mx-auto mb-2 w-10 h-10 flex items-center justify-center"
        >
          <IconCrown size={36} />
        </motion.div>
        <div className="text-[10px] uppercase tracking-widest text-amber-300/60 font-semibold">Torneio terminado</div>
        <div className="font-serif text-2xl font-bold text-[var(--text-warm)] mt-1 mb-4">
          {champion.name}
          {champion.playerId === youId && <span className="text-sm text-white/40 font-sans"> (tu)</span>}
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          {order.map((f) => {
            const style = PLACE_STYLE[f.place];
            return (
              <div
                key={f.playerId}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${
                  style ? `${style.ring} bg-white/[0.03]` : "border-white/5 text-white/50"
                }`}
              >
                <span className="w-7 text-center font-mono font-bold tabular-nums">{f.place}º</span>
                <span className="flex-1 truncate text-sm font-semibold">
                  {f.name}
                  {f.playerId === youId && <span className="text-white/40 font-normal"> (tu)</span>}
                </span>
                {style && <span className="text-[10px] uppercase tracking-wider opacity-80">{style.label}</span>}
              </div>
            );
          })}
        </div>

        <div className="text-white/30 text-[11px] mt-4">
          Nível {room.blind_level + 1} · blinds {room.small_blind}/{room.big_blind} · {room.hand_number} mãos
        </div>
      </motion.div>
    </div>
  );
}
