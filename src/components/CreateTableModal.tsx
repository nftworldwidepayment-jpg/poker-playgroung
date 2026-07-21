"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CreateRoomOptions } from "@/lib/api";
import { randomTableName } from "@/lib/tableNames";
import { CountUp } from "./CountUp";
import { AvatarPicker } from "./AvatarPicker";
import { useSettings } from "@/lib/settings";
import { loadSavedAvatar, saveAvatar } from "@/lib/avatars";
import { playCheck, playChip, playYourAction } from "@/lib/sounds";
import { IconCheck, IconClose, IconDice } from "./icons";

const PREFS_KEY = "poker-create-prefs-v1";

interface Prefs {
  tableName: string;
  gameType: "nlhe" | "plo4";
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  maxPlayers: number;
  turnSeconds: number;
  ante: number;
  anteOn: boolean;
  allowStraddle: boolean;
  runItTwice: boolean;
  rabbitHunt: boolean;
  isPrivate: boolean;
}

const DEFAULT_PREFS: Prefs = {
  tableName: "",
  gameType: "nlhe",
  smallBlind: 10,
  bigBlind: 20,
  buyIn: 1000,
  maxPlayers: 9,
  turnSeconds: 30,
  ante: 0,
  anteOn: false,
  allowStraddle: true,
  runItTwice: false,
  rabbitHunt: true,
  isPrivate: false,
};

export function loadCreatePrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // ignore — quota or private-mode storage failure, not worth surfacing
  }
}

const BLIND_PRESETS = [
  { label: "Micro", sb: 5, bb: 10 },
  { label: "Baixo", sb: 10, bb: 20 },
  { label: "Médio", sb: 25, bb: 50 },
  { label: "Alto", sb: 100, bb: 200 },
];

const SEAT_OPTIONS = [
  { n: 2, label: "Heads-up" },
  { n: 6, label: "6-max" },
  { n: 9, label: "9-max" },
];

const TIMER_OPTIONS = [15, 30, 60];

// mini table graphic — seat dots arranged in an ellipse, count/shape react live
// to the chosen table size, exactly like the real felt will look
function MiniTablePreview({ seats, tableName, gameType }: { seats: number; tableName: string; gameType: string }) {
  return (
    <div className="relative w-full aspect-[16/10] rounded-2xl bg-gradient-to-b from-[#1a3226] to-[#0e1d15] border-4 border-[#2a1810] shadow-inner overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center flex-col gap-0.5">
        <span className="text-[9px] uppercase tracking-widest text-[var(--gold)]/50 font-serif">
          {tableName || "A tua mesa"}
        </span>
        <span className="text-[8px] text-white/25 font-mono uppercase">{gameType === "plo4" ? "PLO4" : "Hold'em"}</span>
      </div>
      {Array.from({ length: seats }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / seats - Math.PI / 2;
        const left = 50 + 42 * Math.cos(angle);
        const top = 50 + 38 * Math.sin(angle);
        return (
          <motion.div
            key={`${seats}-${i}`}
            layout
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.02 }}
            className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 border border-[var(--gold)]/30"
            style={{ left: `${left}%`, top: `${top}%` }}
          />
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]/50 font-semibold mb-2 flex items-center gap-2">
      <span>{children}</span>
      <span className="flex-1 h-px bg-gradient-to-r from-[var(--gold)]/20 to-transparent" />
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className="text-[11px] text-[var(--danger)] mt-1"
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// custom gold switch — used for every boolean toggle in this panel so they all
// share the same 180ms feel instead of raw browser checkboxes
function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        playCheck();
        playYourAction();
        onChange(!checked);
      }}
      className={`relative w-10 h-6 rounded-full shrink-0 transition-colors duration-150 ${
        disabled ? "bg-white/5 cursor-not-allowed" : checked ? "bg-gradient-to-r from-[var(--gold-deep)] to-[var(--gold)]" : "bg-white/10"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`absolute top-0.5 w-5 h-5 rounded-full shadow ${disabled ? "bg-white/20" : "bg-white"}`}
        style={{ left: checked ? "calc(100% - 22px)" : "2px" }}
      />
    </button>
  );
}

export function CreateTableModal({
  open,
  onClose,
  onCreate,
  defaultName,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (opts: CreateRoomOptions) => Promise<void>;
  defaultName: string;
}) {
  const [settings] = useSettings();
  const [playerName, setPlayerName] = useState(defaultName);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [customBlinds, setCustomBlinds] = useState(false);
  const [password, setPassword] = useState("");
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setPrefs(loadCreatePrefs());
      setPlayerName(defaultName);
      setAvatarKey(loadSavedAvatar());
      setTouched({});
      setServerError("");
      setSuccess(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function patch(p: Partial<Prefs>) {
    setPrefs((cur) => ({ ...cur, ...p }));
  }

  function applyBlindPreset(sb: number, bb: number) {
    playYourAction();
    setCustomBlinds(false);
    patch({ smallBlind: sb, bigBlind: bb, buyIn: bb * 50 });
  }

  const nameError = touched.name && !playerName.trim() ? "Escreve o teu nome" : undefined;
  const blindError =
    touched.blinds && prefs.bigBlind <= prefs.smallBlind ? "A big blind tem de ser maior que a small blind" : undefined;
  const buyInMin = prefs.bigBlind * 10;
  const buyInError = touched.buyIn && prefs.buyIn < buyInMin ? `Mínimo ${buyInMin.toLocaleString("pt-PT")} fichas` : undefined;
  const passwordError =
    touched.password && prefs.isPrivate && password.trim().length < 4 ? "Mínimo 4 caracteres" : undefined;

  const formValid =
    playerName.trim().length > 0 &&
    prefs.bigBlind > prefs.smallBlind &&
    prefs.buyIn >= buyInMin &&
    (!prefs.isPrivate || password.trim().length >= 4);

  const missingSummary = useMemo(() => {
    const missing: string[] = [];
    if (!playerName.trim()) missing.push("o teu nome");
    if (prefs.bigBlind <= prefs.smallBlind) missing.push("blinds válidas");
    if (prefs.buyIn < buyInMin) missing.push("buy-in mínimo");
    if (prefs.isPrivate && password.trim().length < 4) missing.push("palavra-passe (mín. 4)");
    return missing;
  }, [playerName, prefs, buyInMin, password]);

  const estimatedBB = Math.round(prefs.buyIn / prefs.bigBlind);

  async function handleSubmit() {
    setTouched({ name: true, blinds: true, buyIn: true, password: true });
    if (!formValid || submitting) return;
    setSubmitting(true);
    setServerError("");
    playChip();
    try {
      const finalPrefs: Prefs = { ...prefs, ante: prefs.anteOn ? prefs.ante : 0 };
      savePrefs(finalPrefs);
      await onCreate({
        name: playerName.trim(),
        tableName: prefs.tableName.trim() || undefined,
        smallBlind: prefs.smallBlind,
        bigBlind: prefs.bigBlind,
        buyIn: prefs.buyIn,
        gameType: prefs.gameType,
        runItTwiceEnabled: prefs.runItTwice,
        rabbitHuntEnabled: prefs.rabbitHunt,
        maxPlayers: prefs.maxPlayers,
        ante: finalPrefs.ante,
        turnSeconds: prefs.turnSeconds,
        allowStraddle: prefs.allowStraddle,
        joinPassword: prefs.isPrivate ? password.trim() : undefined,
        avatarKey: avatarKey || undefined,
      });
      setSuccess(true);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Erro ao criar a mesa");
      setSubmitting(false);
    }
  }

  function handleCloseAttempt() {
    if (submitting) return;
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleCloseAttempt}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: settings.reducedMotion ? 1 : 0.96, y: settings.reducedMotion ? 0 : 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: settings.reducedMotion ? 1 : 0.96, y: settings.reducedMotion ? 0 : 12 }}
        transition={{ duration: settings.reducedMotion ? 0.15 : 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full sm:max-w-[560px] max-h-[92vh] sm:max-h-[85vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)), radial-gradient(ellipse 120% 60% at 50% -10%, rgba(22,40,31,0.6), transparent), #0a0e12",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* drag handle, mobile bottom-sheet affordance */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="p-6 sm:p-8">
          {success ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-4"
            >
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--gold-bright)] to-[var(--gold-deep)] flex items-center justify-center text-slate-900 shadow-[0_0_40px_rgba(201,169,97,0.5)]"
              >
                <IconCheck size={28} />
              </motion.div>
              <div className="text-white/70 font-serif">Mesa criada, a entrar...</div>
            </motion.div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="font-serif text-3xl font-bold text-white/95">Criar Mesa</h2>
                  <p className="text-white/40 text-sm mt-1">Configura a tua mesa privada em segundos.</p>
                </div>
                <button
                  onClick={handleCloseAttempt}
                  aria-label="Fechar"
                  className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition flex items-center justify-center shrink-0"
                >
                  <IconClose size={16} />
                </button>
              </div>

              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center justify-between gap-3 bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-xl px-4 py-2.5 text-sm text-rose-200"
                >
                  <span>{serverError}</span>
                  <button onClick={handleSubmit} className="shrink-0 underline underline-offset-2 hover:text-white">
                    Tentar novamente
                  </button>
                </motion.div>
              )}

              <div className="flex flex-col gap-6 mt-6">
                {/* IDENTIDADE */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
                  <SectionLabel>Identidade</SectionLabel>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-[11px] text-white/40 mb-1 block">O teu nome</label>
                      <input
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                        maxLength={20}
                        placeholder="Ex: João"
                        aria-label="O teu nome"
                        aria-invalid={!!nameError}
                        className={`w-full bg-black/30 border rounded-xl px-3.5 py-2.5 outline-none transition placeholder:text-white/20 ${
                          nameError ? "border-[var(--danger)]/60" : "border-white/10 focus:border-[var(--gold)]/60 focus:shadow-[0_0_0_3px_rgba(201,169,97,0.12)]"
                        }`}
                      />
                      <FieldError msg={nameError} />
                    </div>
                    <AvatarPicker
                      value={avatarKey}
                      onChange={(v) => {
                        setAvatarKey(v);
                        saveAvatar(v);
                      }}
                    />
                    <div>
                      <label className="text-[11px] text-white/40 mb-1 flex items-center justify-between">
                        <span>Nome da mesa (opcional)</span>
                        <span className="text-white/20 font-mono">{prefs.tableName.length}/30</span>
                      </label>
                      <div className="relative">
                        <input
                          value={prefs.tableName}
                          onChange={(e) => patch({ tableName: e.target.value.slice(0, 30) })}
                          placeholder="Ex: Mesa dos Amigos"
                          aria-label="Nome da mesa"
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 pr-11 outline-none focus:border-[var(--gold)]/60 focus:shadow-[0_0_0_3px_rgba(201,169,97,0.12)] transition placeholder:text-white/20"
                        />
                        <button
                          type="button"
                          title="Sugerir nome"
                          onClick={() => {
                            playYourAction();
                            patch({ tableName: randomTableName() });
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-[var(--gold)] transition"
                        >
                          <IconDice size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-3.5 py-3">
                      <div>
                        <div className="text-sm text-white/80 font-semibold">Mesa privada</div>
                        <div className="text-[11px] text-white/35">Exige palavra-passe além do código</div>
                      </div>
                      <Switch checked={prefs.isPrivate} onChange={(v) => patch({ isPrivate: v })} label="Mesa privada" />
                    </div>
                    <AnimatePresence>
                      {prefs.isPrivate && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                            placeholder="Palavra-passe (mín. 4 caracteres)"
                            aria-label="Palavra-passe da mesa"
                            className={`w-full bg-black/30 border rounded-xl px-3.5 py-2.5 outline-none transition ${
                              passwordError ? "border-[var(--danger)]/60" : "border-white/10 focus:border-[var(--gold)]/60"
                            }`}
                          />
                          <FieldError msg={passwordError} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* JOGO */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                  <SectionLabel>Jogo</SectionLabel>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {[
                      { key: "nlhe" as const, title: "Hold'em", desc: "2 cartas · no-limit" },
                      { key: "plo4" as const, title: "PLO4", desc: "4 cartas · pot-limit" },
                    ].map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => {
                          playYourAction();
                          patch({ gameType: g.key });
                        }}
                        className={`text-left rounded-xl border p-3 transition ${
                          prefs.gameType === g.key
                            ? "border-[var(--gold)]/60 bg-[var(--gold)]/[0.08] shadow-[0_1px_0_0_rgba(201,169,97,0.3)] -translate-y-px"
                            : "border-white/10 bg-black/20 hover:bg-black/30 hover:border-white/20"
                        }`}
                      >
                        <div className="text-sm font-bold text-white/90">{g.title}</div>
                        <div className="text-[10px] text-white/40">{g.desc}</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {[
                      { label: "Cash", enabled: true },
                      { label: "Sit & Go", enabled: false },
                      { label: "Torneio", enabled: false },
                    ].map((f) => (
                      <div
                        key={f.label}
                        title={f.enabled ? undefined : "Em breve"}
                        className={`flex-1 text-center text-[11px] font-semibold rounded-lg py-1.5 border ${
                          f.enabled
                            ? "border-[var(--gold)]/40 bg-[var(--gold)]/[0.06] text-[var(--gold-bright)]"
                            : "border-white/5 text-white/20 cursor-not-allowed"
                        }`}
                      >
                        {f.label}
                        {!f.enabled && <span className="block text-[8px] normal-case">em breve</span>}
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* STAKES */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <SectionLabel>Stakes</SectionLabel>
                  <div className="flex gap-1.5 mb-2.5">
                    {BLIND_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyBlindPreset(p.sb, p.bb)}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                          !customBlinds && prefs.smallBlind === p.sb && prefs.bigBlind === p.bb
                            ? "bg-[var(--gold)] text-slate-900 border-[var(--gold-bright)]"
                            : "bg-black/20 hover:bg-black/30 text-white/60 border-white/10"
                        }`}
                      >
                        {p.label}
                        <span className="block font-mono text-[9px] opacity-70">
                          {p.sb}/{p.bb}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        playYourAction();
                        setCustomBlinds(true);
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                        customBlinds
                          ? "bg-[var(--gold)] text-slate-900 border-[var(--gold-bright)]"
                          : "bg-black/20 hover:bg-black/30 text-white/60 border-white/10"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  <AnimatePresence>
                    {customBlinds && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden grid grid-cols-2 gap-2 mb-1"
                      >
                        <div>
                          <span className="text-[10px] text-white/35 mb-1 block">Small Blind</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={prefs.smallBlind}
                            aria-label="Small blind"
                            onChange={(e) => {
                              const sb = Math.max(1, Number(e.target.value) || 1);
                              patch({ smallBlind: sb, bigBlind: Math.max(prefs.bigBlind, sb * 2 === prefs.bigBlind ? sb * 2 : prefs.bigBlind) });
                            }}
                            onBlur={() => setTouched((t) => ({ ...t, blinds: true }))}
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--gold)]/60 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-white/35 mb-1 block">Big Blind</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={2}
                            value={prefs.bigBlind}
                            aria-label="Big blind"
                            onChange={(e) => patch({ bigBlind: Math.max(1, Number(e.target.value) || 1) })}
                            onBlur={() => setTouched((t) => ({ ...t, blinds: true }))}
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--gold)]/60 font-mono"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <FieldError msg={blindError} />

                  <div className="mt-3">
                    <label className="text-[11px] text-white/40 mb-1.5 flex items-center justify-between">
                      <span>Fichas iniciais</span>
                      <span className="font-mono text-[var(--gold-bright)]">
                        <CountUp value={prefs.buyIn} /> · {estimatedBB} BB
                      </span>
                    </label>
                    <input
                      type="range"
                      min={buyInMin}
                      max={prefs.bigBlind * 400}
                      step={prefs.bigBlind}
                      value={prefs.buyIn}
                      aria-label="Fichas iniciais"
                      onChange={(e) => patch({ buyIn: Number(e.target.value) })}
                      onBlur={() => setTouched((t) => ({ ...t, buyIn: true }))}
                      className="w-full accent-[var(--gold)]"
                    />
                    <div className="flex justify-between text-[9px] text-white/25 font-mono px-0.5">
                      <span>{buyInMin}</span>
                      <span>{Math.round(prefs.bigBlind * 400)}</span>
                    </div>
                    <FieldError msg={buyInError} />
                  </div>
                </motion.div>

                {/* REGRAS */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                  <SectionLabel>Regras</SectionLabel>
                  <div className="mb-3">
                    <label className="text-[11px] text-white/40 mb-1.5 block">Lugares</label>
                    <div className="flex gap-2">
                      {SEAT_OPTIONS.map((s) => (
                        <button
                          key={s.n}
                          type="button"
                          onClick={() => {
                            playYourAction();
                            patch({ maxPlayers: s.n });
                          }}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-semibold border transition ${
                            prefs.maxPlayers === s.n
                              ? "bg-[var(--gold)] text-slate-900 border-[var(--gold-bright)]"
                              : "bg-black/20 hover:bg-black/30 text-white/60 border-white/10"
                          }`}
                        >
                          {s.n} <span className="block text-[9px] opacity-70">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="text-[11px] text-white/40 mb-1.5 block">Timer por ação</label>
                    <div className="flex gap-2">
                      {TIMER_OPTIONS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            playYourAction();
                            patch({ turnSeconds: t });
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                            prefs.turnSeconds === t
                              ? "bg-[var(--gold)] text-slate-900 border-[var(--gold-bright)]"
                              : "bg-black/20 hover:bg-black/30 text-white/60 border-white/10"
                          }`}
                        >
                          {t}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="w-full flex items-center justify-between text-[11px] text-white/40 hover:text-white/70 transition py-1"
                  >
                    <span>Opções avançadas</span>
                    <motion.span animate={{ rotate: advancedOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                      ▾
                    </motion.span>
                  </button>
                  <AnimatePresence>
                    {advancedOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden flex flex-col gap-2.5 pt-2"
                      >
                        <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-3.5 py-3">
                          <div>
                            <div className="text-sm text-white/80 font-semibold">Ante</div>
                            <div className="text-[11px] text-white/35">Todos pagam uma pequena entrada em cada mão</div>
                          </div>
                          <Switch
                            checked={prefs.anteOn}
                            onChange={(v) => patch({ anteOn: v, ante: v && !prefs.ante ? Math.round(prefs.bigBlind / 5) : prefs.ante })}
                            label="Ante"
                          />
                        </div>
                        <AnimatePresence>
                          {prefs.anteOn && (
                            <motion.input
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={prefs.ante}
                              aria-label="Valor do ante"
                              onChange={(e) => patch({ ante: Math.max(1, Number(e.target.value) || 1) })}
                              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--gold)]/60 font-mono"
                            />
                          )}
                        </AnimatePresence>

                        <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-3.5 py-3">
                          <div>
                            <div className="text-sm text-white/80 font-semibold">Straddle</div>
                            <div className="text-[11px] text-white/35">Jogadores podem straddle voluntário</div>
                          </div>
                          <Switch checked={prefs.allowStraddle} onChange={(v) => patch({ allowStraddle: v })} label="Permitir straddle" />
                        </div>

                        <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-3.5 py-3">
                          <div>
                            <div className="text-sm text-white/80 font-semibold">Run It Twice</div>
                            <div className="text-[11px] text-white/35">Divide o pote em duas mesas em all-in</div>
                          </div>
                          <Switch checked={prefs.runItTwice} onChange={(v) => patch({ runItTwice: v })} label="Run It Twice" />
                        </div>

                        <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-3.5 py-3">
                          <div>
                            <div className="text-sm text-white/80 font-semibold">Rabbit Hunt</div>
                            <div className="text-[11px] text-white/35">Mostra as cartas que viriam depois de alguém desistir</div>
                          </div>
                          <Switch checked={prefs.rabbitHunt} onChange={(v) => patch({ rabbitHunt: v })} label="Rabbit Hunt" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* PREVIEW */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                  <SectionLabel>Pré-visualização</SectionLabel>
                  <MiniTablePreview seats={prefs.maxPlayers} tableName={prefs.tableName} gameType={prefs.gameType} />
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <span className="text-[10px] font-mono bg-black/30 border border-white/10 rounded-full px-2.5 py-1 text-white/60">
                      {prefs.gameType === "plo4" ? "PLO4" : "Hold'em"}
                    </span>
                    <span className="text-[10px] font-mono bg-black/30 border border-white/10 rounded-full px-2.5 py-1 text-white/60">
                      {prefs.smallBlind}/{prefs.bigBlind}
                    </span>
                    <span className="text-[10px] font-mono bg-black/30 border border-white/10 rounded-full px-2.5 py-1 text-white/60">
                      {prefs.maxPlayers} lugares
                    </span>
                    <span className="text-[10px] font-mono bg-black/30 border border-white/10 rounded-full px-2.5 py-1 text-[var(--gold-bright)]">
                      <CountUp value={prefs.buyIn} /> fichas
                    </span>
                  </div>
                  <p className="text-[11px] text-white/30 mt-2">
                    Stack inicial de {estimatedBB} BB
                    {prefs.anteOn ? ` · ante de ${prefs.ante}` : ""} · pote médio estimado ~
                    {(prefs.bigBlind * 8).toLocaleString("pt-PT")}
                  </p>
                </motion.div>

                <div
                  className="group relative"
                  title={!formValid && missingSummary.length ? `Falta: ${missingSummary.join(", ")}` : undefined}
                >
                  <motion.button
                    whileTap={{ scale: formValid ? 0.97 : 1 }}
                    disabled={submitting}
                    onClick={handleSubmit}
                    className={`relative w-full py-3.5 rounded-xl font-bold overflow-hidden transition ${
                      formValid
                        ? "bg-gradient-to-r from-[var(--gold-bright)] via-[var(--gold)] to-[var(--gold-deep)] text-slate-900 shadow-[0_10px_30px_-8px_rgba(201,169,97,0.6)]"
                        : "bg-white/5 text-white/30 cursor-not-allowed"
                    } disabled:opacity-70`}
                  >
                    {formValid && !submitting && !settings.reducedMotion && (
                      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      {submitting ? (
                        <>
                          <motion.span
                            className="w-4 h-4 rounded-full border-2 border-slate-900/30 border-t-slate-900"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                          />
                          A criar mesa...
                        </>
                      ) : (
                        <>♠ Criar mesa</>
                      )}
                    </span>
                  </motion.button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
