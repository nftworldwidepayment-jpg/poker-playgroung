"use client";
import { motion } from "framer-motion";
import { IconClose } from "./icons";

const TERMS: { term: string; def: string }[] = [
  { term: "Blind (SB/BB)", def: "Apostas obrigatórias postadas antes de ver as cartas, para forçar ação." },
  { term: "Straddle", def: "Aposta voluntária extra antes das cartas, o dobro da big blind, que sobe o preço de entrada." },
  { term: "Ante", def: "Pequena entrada que todos pagam em cada mão, além das blinds, para engordar o pote." },
  { term: "Pot-limit (PLO)", def: "A aposta máxima permitida é o tamanho do pote — nunca podes ir all-in acima disso." },
  { term: "All-in", def: "Apostar todas as fichas que tens." },
  { term: "Pot odds", def: "Relação entre o que custa pagar e o tamanho do pote — ajuda a decidir se vale a pena pagar." },
  { term: "Side pot (pote lateral)", def: "Pote extra criado quando alguém vai all-in por menos do que os outros apostam." },
  { term: "Run It Twice", def: "Em all-in, completar o board duas vezes e dividir o pote ao meio entre os dois resultados." },
  { term: "Rabbit Hunt", def: "Depois de alguém desistir, ver que cartas viriam a seguir — só por curiosidade." },
  { term: "Posição (BTN/SB/BB/UTG/CO/HJ)", def: "Onde estás sentado em relação ao dealer — jogar em posição tardia (BTN/CO) dá vantagem." },
  { term: "VPIP", def: "% de mãos em que um jogador voluntariamente entra no pote — mede o quão \"solto\" joga." },
];

export function Glossary({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e12] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-bold text-white/95">Glossário de Poker</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white flex items-center justify-center"
          >
            <IconClose size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {TERMS.map((t) => (
            <div key={t.term}>
              <div className="text-sm font-semibold text-[var(--gold-bright)]">{t.term}</div>
              <div className="text-xs text-white/50">{t.def}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
