"use client";
import { useEffect, useReducer, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BJState,
  BJHand,
  MAX_HANDS,
  DECK_COUNT,
  initState,
  deal,
  hit,
  stand,
  doubleDown,
  split,
  canSplit,
  takeInsurance,
  nextRound,
  setBet,
  handValue,
} from "@/lib/blackjack";
import { Card } from "@/lib/types";
import { PlayingCard, CardSlot } from "./PlayingCard";
import { ChipStack } from "./Chip";
import { CountUp } from "./CountUp";
import { playChip, playDeal, playFold, playWin } from "@/lib/sounds";

const BET_CHIPS = [10, 25, 50, 100, 250];

function useBlackjack() {
  const [tick, force] = useReducer((c: number) => c + 1, 0);
  const ref = useRef<BJState>(initState());
  const dispatch = (fn: (s: BJState) => void) => {
    fn(ref.current);
    force();
  };
  return { state: ref.current, dispatch, tick };
}

function HandTotal({ cards }: { cards: Card[] }) {
  if (!cards.length) return null;
  const { total, soft } = handValue(cards);
  return (
    <span className="text-[11px] font-mono text-white/50 tabular-nums">
      {soft && total <= 21 ? `${total - 10}/${total}` : total}
    </span>
  );
}

function HandBadge({ result }: { result: BJHand["result"] }) {
  if (!result) return null;
  const map = {
    win: { text: "GANHOU", cls: "bg-emerald-500/90 text-emerald-950" },
    blackjack: { text: "BLACKJACK!", cls: "bg-amber-400/95 text-amber-950" },
    push: { text: "EMPATE", cls: "bg-white/20 text-white/80" },
    lose: { text: "PERDEU", cls: "bg-rose-600/90 text-rose-50" },
  } as const;
  const m = map[result];
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow ${m.cls}`}
    >
      {m.text}
    </motion.span>
  );
}

export function Blackjack() {
  const { state, dispatch, tick } = useBlackjack();
  const busy = state.phase === "dealer";
  const announcedRef = useRef(-1);

  useEffect(() => {
    if (state.phase === "settled" && announcedRef.current !== state.handsPlayed) {
      announcedRef.current = state.handsPlayed;
      if (state.message?.startsWith("+")) playWin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  function handleDeal() {
    playDeal();
    dispatch((s) => deal(s));
  }
  function handleHit() {
    const hand = state.hands[state.active];
    playChip();
    dispatch((s) => hit(s));
    if (hand && handValue(hand.cards).total > 21) playFold();
  }
  function handleStand() {
    dispatch((s) => stand(s));
  }
  function handleDouble() {
    playChip();
    dispatch((s) => doubleDown(s));
  }
  function handleSplit() {
    playChip();
    dispatch((s) => split(s));
  }
  function handleInsurance(accept: boolean) {
    dispatch((s) => takeInsurance(s, accept));
  }
  function handleNext() {
    dispatch((s) => nextRound(s));
  }
  function handleBet(delta: number) {
    dispatch((s) => setBet(s, s.currentBet + delta));
  }

  const active = state.hands[state.active];
  const canAct = state.phase === "player" && !state.insuranceOffered && active && !active.finished;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-4 px-2">
      {/* felt table — pure CSS, no image asset needed, keeps this fast to load */}
      <div
        className="relative w-full rounded-[3rem] border-4 border-[var(--gold-deep)]/60 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] px-4 sm:px-8 py-6 sm:py-8 flex flex-col items-center gap-5 min-h-[420px]"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 20%, #1e3a2f 0%, #16281f 55%, #0d1712 100%)",
        }}
      >
        <div className="absolute inset-3 rounded-[2.6rem] border border-white/10 pointer-events-none felt-texture" />

        <div className="flex items-center justify-between w-full text-[10px] uppercase tracking-widest text-amber-200/50 font-serif">
          <span>Blackjack paga 3:2</span>
          <span>{DECK_COUNT} baralhos · {state.shoe.length} cartas restantes</span>
        </div>

        {/* dealer */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Dealer</div>
          <div className="flex gap-1.5 min-h-[84px] items-start">
            {state.dealer.length === 0 ? (
              <>
                <CardSlot size="md" />
                <CardSlot size="md" />
              </>
            ) : (
              state.dealer.map((c, i) => (
                <PlayingCard key={i} card={c} hidden={i === 1 && state.dealerHidden} size="md" delay={i * 0.08} />
              ))
            )}
          </div>
          {!state.dealerHidden && state.dealer.length > 0 && <HandTotal cards={state.dealer} />}
        </div>

        {/* player hands */}
        <div className="flex flex-wrap justify-center gap-3 w-full">
          {state.phase === "betting" ? (
            <div className="text-white/30 text-sm italic py-6">Faz a tua aposta e clica em Distribuir</div>
          ) : (
            state.hands.map((h, i) => (
              <div
                key={i}
                className={`relative flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition ${
                  i === state.active && state.phase === "player" && !h.finished
                    ? "bg-amber-400/[0.08] ring-1 ring-amber-400/40"
                    : ""
                }`}
              >
                <HandBadge result={h.result} />
                <div className="flex gap-1">
                  {h.cards.map((c, j) => (
                    <PlayingCard key={j} card={c} size="sm" delay={j * 0.06} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <HandTotal cards={h.cards} />
                  <span className="text-[10px] text-amber-200/60 font-mono">· {h.bet}</span>
                  {h.doubled && <span className="text-[9px] text-cyan-300/70">2x</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* controls */}
      <div className="w-full flex flex-col items-center gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-white/50">
            Banca: <CountUp value={state.bankroll} className="text-amber-200 font-mono font-bold" />
          </span>
          {state.phase === "settled" && state.message && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`font-mono font-bold ${state.message.startsWith("+") ? "text-emerald-300" : state.message === "Empate" ? "text-white/50" : "text-rose-300"}`}
            >
              {state.message}
            </motion.span>
          )}
        </div>

        {state.phase === "betting" && (
          <>
            <div className="flex items-center gap-2">
              {BET_CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => handleBet(c)}
                  disabled={state.currentBet + c > state.bankroll}
                  className="flex flex-col items-center gap-0.5 disabled:opacity-30 hover:scale-110 transition"
                  title={`+${c}`}
                >
                  <ChipStack amount={c} size={30} />
                </button>
              ))}
              <button
                onClick={() => dispatch((s) => setBet(s, 0))}
                className="text-[10px] text-white/30 hover:text-white/60 ml-1 underline underline-offset-2"
              >
                limpar
              </button>
            </div>
            <div className="text-sm text-white/60">
              Aposta: <span className="text-amber-200 font-mono font-bold">{state.currentBet}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleDeal}
              disabled={state.currentBet <= 0 || state.currentBet > state.bankroll}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-bold shadow-lg disabled:opacity-40"
            >
              ♠ Distribuir
            </motion.button>
          </>
        )}

        {state.insuranceOffered && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 bg-black/40 border border-amber-400/25 rounded-xl px-4 py-2.5">
            <span className="text-xs text-white/70">O dealer mostra Ás — queres seguro?</span>
            <button onClick={() => handleInsurance(true)} className="px-3 py-1 rounded-lg bg-amber-500/90 text-slate-900 text-xs font-bold">
              Sim
            </button>
            <button onClick={() => handleInsurance(false)} className="px-3 py-1 rounded-lg bg-white/10 text-white/70 text-xs">
              Não
            </button>
          </motion.div>
        )}

        {canAct && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap justify-center gap-2">
              <button onClick={handleHit} className="px-5 py-2.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-400 text-emerald-950 font-bold text-sm transition">
                Pedir
              </button>
              <button onClick={handleStand} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/80 font-bold text-sm transition">
                Plantar
              </button>
              <button
                onClick={handleDouble}
                disabled={active!.cards.length !== 2 || active!.bet > state.bankroll}
                className="px-5 py-2.5 rounded-xl bg-cyan-500/80 hover:bg-cyan-400 text-cyan-950 font-bold text-sm transition disabled:opacity-30"
              >
                Dobrar
              </button>
              <button
                onClick={handleSplit}
                disabled={!canSplit(state)}
                className="px-5 py-2.5 rounded-xl bg-fuchsia-500/80 hover:bg-fuchsia-400 text-fuchsia-950 font-bold text-sm transition disabled:opacity-30"
              >
                Dividir {state.hands.length >= MAX_HANDS ? `(máx ${MAX_HANDS})` : ""}
              </button>
            </motion.div>
          </AnimatePresence>
        )}

        {busy && <div className="text-white/40 text-sm animate-pulse">O dealer está a jogar...</div>}

        {state.phase === "settled" && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleNext}
            disabled={state.bankroll <= 0}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-bold shadow-lg disabled:opacity-40"
          >
            {state.bankroll <= 0 ? "Sem fichas — recarrega a página" : "Próxima Mão →"}
          </motion.button>
        )}

        <div className="text-[10px] text-white/25 font-mono">Mão nº {state.handsPlayed}</div>
      </div>
    </div>
  );
}
