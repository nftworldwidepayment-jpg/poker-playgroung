"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Settings, useSettings } from "@/lib/settings";
import { IconClose } from "./icons";

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className="flex items-center justify-between gap-4 w-full py-3 text-left group"
    >
      <span>
        <span className="block text-sm text-[var(--text-warm)] font-medium">{label}</span>
        {desc && <span className="block text-[11px] text-white/40 mt-0.5">{desc}</span>}
      </span>
      <span
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
          value ? "bg-[var(--gold)]" : "bg-white/12"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
          style={{ left: value ? 22 : 2 }}
        />
      </span>
    </button>
  );
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, update] = useSettings();
  const set = (k: keyof Settings) => (v: boolean) => update({ [k]: v });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto bg-gradient-to-b from-[var(--bg-raised)] to-[var(--bg-deep)] border border-white/10 rounded-2xl p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-xl font-bold text-[var(--text-warm)]">Definições</h2>
              <button onClick={onClose} className="text-white/40 hover:text-white px-1">
                <IconClose size={16} />
              </button>
            </div>

            <div className="text-[10px] uppercase tracking-widest text-[var(--gold)]/70 font-semibold mt-2 mb-0.5">
              Aspeto
            </div>
            <div className="divide-y divide-white/5">
              <Toggle
                label="Baralho de 4 cores"
                desc="Ouros a azul, paus a verde — leitura rápida dos naipes"
                value={settings.fourColorDeck}
                onChange={set("fourColorDeck")}
              />
              <Toggle
                label="Modo ambiente"
                desc="Reduz brilho e movimento para sessões longas"
                value={settings.reducedMotion}
                onChange={set("reducedMotion")}
              />
              <Toggle
                label="Alto contraste"
                desc="Texto e bordas mais fortes, para melhor legibilidade"
                value={settings.highContrast}
                onChange={set("highContrast")}
              />
            </div>

            <div className="py-3">
              <span className="block text-sm text-[var(--text-warm)] font-medium mb-2">Tamanho do texto</span>
              <div className="flex gap-1.5">
                {(["sm", "md", "lg"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ fontSize: s })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      settings.fontSize === s
                        ? "bg-[var(--gold)] text-slate-900 border-[var(--gold-bright)]"
                        : "bg-white/5 hover:bg-white/10 text-white/60 border-white/10"
                    }`}
                  >
                    {s === "sm" ? "Pequeno" : s === "md" ? "Normal" : "Grande"}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[10px] uppercase tracking-widest text-[var(--gold)]/70 font-semibold mt-4 mb-0.5">
              Jogo
            </div>
            <div className="divide-y divide-white/5">
              <Toggle
                label="Mostrar stacks em BB"
                desc="Valores em big blinds em vez de fichas"
                value={settings.bbDisplay}
                onChange={set("bbDisplay")}
              />
              <Toggle
                label="Força da mão"
                desc={'Indica a tua combinação atual (ex.: "Par de Damas")'}
                value={settings.handStrength}
                onChange={set("handStrength")}
              />
              <Toggle
                label="Modo rápido"
                desc="Animações a 2x — para grinders"
                value={settings.fastMode}
                onChange={set("fastMode")}
              />
            </div>

            <div className="text-[10px] uppercase tracking-widest text-[var(--gold)]/70 font-semibold mt-4 mb-0.5">
              Áudio
            </div>
            <div className="divide-y divide-white/5">
              <Toggle
                label="Sons"
                desc="Deal, check, fichas, vitória"
                value={settings.sound}
                onChange={set("sound")}
              />
            </div>

            <div className="text-[10px] uppercase tracking-widest text-[var(--gold)]/70 font-semibold mt-4 mb-1.5">
              Novidades
            </div>
            <ul className="text-[11px] text-white/45 leading-relaxed list-disc pl-4 mb-1 space-y-0.5 max-h-24 overflow-y-auto">
              <li>Corrigido: um all-in desnivelado já não mostra o stack maior a &quot;ganhar&quot; a sua própria sobra não igualada</li>
              <li>Slow roll dramático antes de revelar o vencedor</li>
              <li>Ícones profissionais em vez de emojis em toda a app</li>
              <li>Mesas de 7-9 jogadores já não se sobrepõem no telemóvel</li>
              <li>Bots com tempo de decisão consoante a dificuldade</li>
            </ul>

            <button
              onClick={onClose}
              className="mt-4 w-full py-2.5 rounded-xl bg-[var(--gold)] text-slate-900 font-bold hover:brightness-110 transition"
            >
              Concluído
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
