"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayerRow, RoomRow } from "@/lib/types";
import { ChipStack } from "./Chip";

const fmt = (n: number) => n.toLocaleString("pt-PT");
const fmtBB = (n: number, bb: number) => {
  const v = n / bb;
  return `${v % 1 === 0 ? v : v.toFixed(1)}BB`;
};

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
  const canRaise = !sliderDisabled && maxRaiseTo > room.current_bet;
  const step = Math.max(1, room.big_blind);

  const [raiseTo, setRaiseTo] = useState(clampedMin);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [confirmingRaise, setConfirmingRaise] = useState(false);
  const [confirmingAllIn, setConfirmingAllIn] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const isPLO = room.game_type === "plo4";

  useEffect(() => {
    setRaiseTo(clampedMin);
    setEditing(false);
    setConfirmingRaise(false);
    setConfirmingAllIn(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.hand_number, room.phase, room.current_bet]);

  // the all-in confirm state auto-expires so it never sticks around
  useEffect(() => {
    if (!confirmingAllIn) return;
    const t = setTimeout(() => setConfirmingAllIn(false), 2500);
    return () => clearTimeout(t);
  }, [confirmingAllIn]);

  function submitAllIn() {
    // PLO is pot-limit: "all-in" is capped server-side at the pot-size raise,
    // so the button honestly reads "Pote" and needs no scare-confirm.
    if (isPLO || confirmingAllIn) {
      setConfirmingAllIn(false);
      onAction("all_in");
      return;
    }
    setConfirmingAllIn(true);
  }

  function clamp(v: number) {
    return Math.min(Math.max(Math.round(v), clampedMin), maxRaiseTo);
  }

  const isBigRaise = canRaise && (raiseTo >= maxRaiseTo || raiseTo - room.current_bet >= you.chips * 0.5);

  function submitRaise() {
    if (isBigRaise && !confirmingRaise) {
      setConfirmingRaise(true);
      return;
    }
    setConfirmingRaise(false);
    onAction("raise", clamp(raiseTo));
  }

  // keyboard shortcuts: F=fold, C=check/call, R=confirm raise at current slider value, A=all-in
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || busy) return;
      if (e.key === "f" || e.key === "F") onAction("fold");
      else if (e.key === "c" || e.key === "C") onAction(canCheck ? "check" : "call");
      else if (e.key === "a" || e.key === "A") submitAllIn();
      else if ((e.key === "r" || e.key === "R") && canRaise) submitRaise();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, canCheck, canRaise, raiseTo, confirmingRaise, confirmingAllIn]);

  // native (non-passive) wheel listener so preventDefault actually stops page scroll
  useEffect(() => {
    const el = panelRef.current;
    if (!el || !canRaise) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setRaiseTo((v) => clamp(v + (e.deltaY < 0 ? step : -step)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRaise, clampedMin, maxRaiseTo, step]);

  // presets computed over the CURRENT pot including pending calls (real pot-size raise
  // math, not naive %), fixed order per the GGPoker/Stars convention: Min → fractions → Pot
  const potNow = room.pot + toCall;
  const sizePresets = [
    { label: "Min", value: clampedMin },
    { label: "33%", value: Math.round(room.current_bet + potNow * 0.33) },
    { label: "50%", value: Math.round(room.current_bet + potNow * 0.5) },
    { label: "75%", value: Math.round(room.current_bet + potNow * 0.75) },
    { label: "Pote", value: Math.round(room.current_bet + potNow) },
  ]
    .map((p) => ({ ...p, value: clamp(p.value) }))
    .filter((p, i, arr) => arr.findIndex((x) => x.value === p.value) === i);
  const potPctOfRaise = potNow > 0 ? Math.round(((raiseTo - room.current_bet) / potNow) * 100) : 0;
  const stackFraction = you.chips > 0 ? (raiseTo - you.current_bet) / you.chips : 0;

  const pct = maxRaiseTo > clampedMin ? ((raiseTo - clampedMin) / (maxRaiseTo - clampedMin)) * 100 : 0;

  // pot odds: % of the resulting pot you'd be putting in to continue — a quick
  // gut-check against how often you'd need to win to break even on the call
  const potOddsPct = toCall > 0 ? Math.round((toCall / (room.pot + toCall)) * 100) : null;

  function commitEdit() {
    const n = Number(editValue.replace(/[^\d]/g, ""));
    if (!Number.isNaN(n) && n > 0) setRaiseTo(clamp(n));
    setEditing(false);
  }

  return (
    <motion.div
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black via-black/95 to-black/0 pt-12 pb-4 px-4"
    >
      <div className="max-w-xl mx-auto flex flex-col gap-3">
        {canRaise && (
          <div
            ref={panelRef}
            className="flex flex-col gap-2.5 bg-gradient-to-b from-white/[0.07] to-white/[0.03] rounded-2xl px-4 py-3 border border-amber-400/15 select-none"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                Aposta{room.game_type === "plo4" ? " · pot-limit" : ""}
              </span>
              <span className="text-[10px] text-white/30">roda do rato para ajustar</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                disabled={busy}
                onClick={() => setRaiseTo((v) => clamp(v - step))}
                className="w-9 h-9 shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-amber-200 font-bold text-lg flex items-center justify-center active:scale-90 transition disabled:opacity-30"
              >
                −
              </button>

              <div className="flex-1 flex items-center justify-center gap-2">
                <ChipStack amount={raiseTo} size={18} />
                {editing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditing(false);
                    }}
                    inputMode="numeric"
                    className="w-28 bg-black/40 border border-amber-400/40 rounded-lg text-center font-mono text-lg text-amber-200 py-0.5 outline-none"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditValue(String(raiseTo));
                      setEditing(true);
                    }}
                    className="flex flex-col items-center hover:text-amber-100 transition"
                  >
                    <span className="font-mono text-2xl font-bold text-[var(--gold-bright)] tabular-nums tracking-tight leading-none">
                      {fmt(raiseTo)}
                    </span>
                    <span className="text-[10px] text-[var(--gold)]/70 font-mono tabular-nums">
                      {fmtBB(raiseTo, room.big_blind)} · {potPctOfRaise}% pote
                    </span>
                  </button>
                )}
              </div>

              <button
                disabled={busy}
                onClick={() => setRaiseTo((v) => clamp(v + step))}
                className="w-9 h-9 shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-amber-200 font-bold text-lg flex items-center justify-center active:scale-90 transition disabled:opacity-30"
              >
                +
              </button>
            </div>

            <input
              type="range"
              min={clampedMin}
              max={maxRaiseTo}
              step={1}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, #fbbf24 ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
              }}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br
                [&::-webkit-slider-thumb]:from-amber-300 [&::-webkit-slider-thumb]:to-amber-600
                [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-100
                [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(251,191,36,0.7)]
                [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-amber-300 [&::-moz-range-thumb]:to-amber-600
                [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-amber-100 [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(251,191,36,0.7)]"
            />

            <div className="flex gap-1.5">
              {sizePresets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setRaiseTo(p.value)}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold border transition tabular-nums ${
                    raiseTo === p.value
                      ? "bg-[var(--gold)] text-slate-900 border-[var(--gold-bright)]"
                      : "bg-white/5 hover:bg-white/10 text-[var(--gold)]/90 border-white/10"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {stackFraction > 0.5 && (
              <div className="text-[10px] text-orange-300/80 text-center">
                ⚠ Este sizing compromete {Math.round(stackFraction * 100)}% do teu stack
              </div>
            )}
          </div>
        )}

        {confirmingRaise && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-emerald-950/60 border border-emerald-400/30 rounded-xl px-3 py-2 text-xs"
          >
            <span className="text-emerald-200">Confirmar subida para {fmt(raiseTo)}?</span>
            <div className="flex gap-2">
              <button onClick={() => setConfirmingRaise(false)} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/70">
                Cancelar
              </button>
              <button onClick={submitRaise} className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-900 font-bold hover:bg-emerald-400">
                Confirmar
              </button>
            </div>
          </motion.div>
        )}

        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => onAction("fold")}
            className="flex-1 py-3.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40"
          >
            Desistir <span className="hidden sm:inline text-[10px] opacity-60 font-mono">(F)</span>
          </button>
          <button
            disabled={busy}
            onClick={() => onAction(canCheck ? "check" : "call")}
            className="flex-1 py-3 rounded-xl bg-sky-600/90 hover:bg-sky-600 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40 flex flex-col items-center justify-center leading-tight"
          >
            <span>
              {canCheck ? "Passar" : `Pagar ${fmt(toCall)}`} <span className="hidden sm:inline text-[10px] opacity-60 font-mono">(C)</span>
            </span>
            {!canCheck && (
              <span className="text-[10px] font-mono opacity-70">
                {fmtBB(toCall, room.big_blind)}
                {potOddsPct != null && ` · ${potOddsPct}% pot odds`}
              </span>
            )}
          </button>
          <AnimatePresence>
            {canRaise && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                disabled={busy}
                onClick={submitRaise}
                className="flex-1 py-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 active:scale-95 transition font-bold text-white shadow-lg disabled:opacity-40 flex flex-col items-center justify-center leading-tight"
              >
                <span>
                  Subir <span className="hidden sm:inline text-[10px] opacity-60 font-mono">(R)</span>
                </span>
                <span className="text-[10px] font-mono opacity-80 tabular-nums">para {fmt(raiseTo)}</span>
              </motion.button>
            )}
          </AnimatePresence>
          <button
            disabled={busy}
            onClick={submitAllIn}
            className={`flex-1 py-3.5 rounded-xl transition font-bold text-white shadow-lg disabled:opacity-40 active:scale-95 ${
              confirmingAllIn
                ? "bg-rose-600 animate-pulse"
                : "bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110"
            }`}
          >
            {confirmingAllIn ? "Confirmar?" : isPLO ? "Pote (máx)" : "All-in"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
