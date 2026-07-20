"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api, saveSession, loadLatestSession, loadAllSessions, Session, CreateRoomOptions } from "@/lib/api";
import { Splash } from "@/components/Splash";
import { SettingsModal } from "@/components/SettingsModal";
import { CreateTableModal, loadCreatePrefs } from "@/components/CreateTableModal";
import { JoinRoomModal } from "@/components/JoinRoomModal";
import { useSettings } from "@/lib/settings";
import { IconBot, IconCards, IconFlame, IconGift, IconLeaf, IconSettings, IconSmartphone, IconSwords, IconZap } from "@/components/icons";

const SUITS = ["♠", "♥", "♦", "♣"];
const NAME_KEY = "poker-player-name";

function loadSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}
function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

function FloatingSuits({ reduced }: { reduced: boolean }) {
  const items = [
    { s: "♠", x: "6%", y: "14%", size: 34, dur: 9, delay: 0 },
    { s: "♦", x: "88%", y: "10%", size: 26, dur: 11, delay: 1.2 },
    { s: "♣", x: "12%", y: "78%", size: 30, dur: 10, delay: 0.6 },
    { s: "♥", x: "90%", y: "72%", size: 24, dur: 8, delay: 1.8 },
    { s: "♠", x: "50%", y: "6%", size: 18, dur: 12, delay: 2.4 },
    { s: "♣", x: "80%", y: "42%", size: 20, dur: 9.5, delay: 0.3 },
  ];
  if (reduced) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((it, i) => (
        <motion.div
          key={i}
          className="absolute font-serif text-amber-200/[0.06] select-none"
          style={{ left: it.x, top: it.y, fontSize: it.size }}
          animate={{ y: [0, -18, 0], rotate: [0, 8, 0] }}
          transition={{ duration: it.dur, delay: it.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {it.s}
        </motion.div>
      ))}
    </div>
  );
}

function ChipOrbit({ reduced }: { reduced: boolean }) {
  const chips = [
    { img: "/images/chip-black.webp", x: "-6%", y: "8%", size: 78, rotate: -18, delay: 0 },
    { img: "/images/chip-red.webp", x: "82%", y: "62%", size: 64, rotate: 22, delay: 0.4 },
    { img: "/images/chip-green.webp", x: "-2%", y: "70%", size: 56, rotate: 12, delay: 0.8 },
    { img: "/images/chip-purple.webp", x: "86%", y: "4%", size: 50, rotate: -10, delay: 1.1 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block">
      {chips.map((c, i) => (
        <motion.div
          key={i}
          className="absolute drop-shadow-[0_18px_30px_rgba(0,0,0,0.6)]"
          style={{ left: c.x, top: c.y, width: c.size, height: c.size }}
          initial={{ opacity: 0, y: 20, rotate: c.rotate - 10 }}
          animate={reduced ? { opacity: 0.9, rotate: c.rotate } : { opacity: 0.9, y: [0, -10, 0], rotate: c.rotate }}
          transition={
            reduced
              ? { duration: 0.8, delay: c.delay }
              : {
                  opacity: { duration: 0.8, delay: c.delay },
                  y: { duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: c.delay },
                  rotate: { duration: 0.8, delay: c.delay },
                }
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.img} alt="" className="w-full h-full select-none" draggable={false} />
        </motion.div>
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [settings] = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState("");
  const [canQuickCreate, setCanQuickCreate] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [mode, setMode] = useState<"friends" | "bot">("friends");
  const [botBusy, setBotBusy] = useState<string | null>(null);
  const [botError, setBotError] = useState("");
  const [botName, setBotName] = useState("");

  useEffect(() => {
    setLastSession(loadLatestSession());
    setAllSessions(loadAllSessions());
    const name = loadSavedName();
    setPlayerName(name);
    setBotName(name);
    setCanQuickCreate(!!name && !!localStorage.getItem("poker-create-prefs-v1"));
  }, []);

  async function handleCreate(opts: CreateRoomOptions) {
    const res = await api.createRoom(opts);
    saveSession({ code: res.code, playerId: res.playerId, token: res.token, name: opts.name });
    saveName(opts.name);
    router.push(`/room/${res.code}`);
  }

  async function handleJoin(code: string, name: string, password?: string, avatarKey?: string) {
    const res = await api.joinRoom(code, name, password, avatarKey);
    saveSession({ code: res.code, playerId: res.playerId, token: res.token, name });
    saveName(name);
    router.push(`/room/${res.code}`);
  }

  async function handleQuickCreate() {
    const name = loadSavedName();
    const prefs = loadCreatePrefs();
    if (!name) {
      setCreateOpen(true);
      return;
    }
    setQuickBusy(true);
    setQuickError("");
    try {
      await handleCreate({
        name,
        tableName: prefs.tableName || undefined,
        smallBlind: prefs.smallBlind,
        bigBlind: prefs.bigBlind,
        buyIn: prefs.buyIn,
        gameType: prefs.gameType,
        runItTwiceEnabled: prefs.runItTwice,
        maxPlayers: prefs.maxPlayers,
        ante: prefs.anteOn ? prefs.ante : 0,
        turnSeconds: prefs.turnSeconds,
        allowStraddle: prefs.allowStraddle,
      });
    } catch (e) {
      setQuickError(e instanceof Error ? e.message : "Erro ao criar mesa");
      setQuickBusy(false);
    }
  }

  async function handlePlayVsBot(difficulty: "easy" | "medium" | "hard") {
    const name = botName.trim();
    if (!name) {
      setBotError("Escreve o teu nome");
      return;
    }
    setBotBusy(difficulty);
    setBotError("");
    try {
      const res = await api.createRoom({
        name,
        tableName: "Mesa vs Bot",
        smallBlind: 10,
        bigBlind: 20,
        buyIn: 1000,
        gameType: "nlhe",
        maxPlayers: 2,
      });
      saveSession({ code: res.code, playerId: res.playerId, token: res.token, name });
      saveName(name);
      await api.addBot(res.playerId, res.token, difficulty);
      router.push(`/room/${res.code}`);
    } catch (e) {
      setBotError(e instanceof Error ? e.message : "Erro ao criar mesa contra o bot");
      setBotBusy(null);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden px-4 py-10 sm:py-14">
      <Splash />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CreateTableModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        defaultName={playerName}
      />
      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} onJoin={handleJoin} defaultName={playerName} />

      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-[var(--gold)]/40 transition flex items-center justify-center"
        title="Definições"
        aria-label="Definições"
      >
        <IconSettings size={18} />
      </button>

      {/* layered premium background */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 20% -10%, rgba(16,185,129,0.16), transparent), " +
            "radial-gradient(ellipse 60% 45% at 100% 10%, rgba(245,158,11,0.09), transparent), " +
            "radial-gradient(ellipse 70% 55% at 50% 115%, rgba(168,85,247,0.10), transparent), " +
            "#030507",
        }}
      />
      <div
        className="absolute inset-0 -z-20 opacity-[0.05]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 26px)" }}
      />
      <div className="absolute inset-0 -z-10" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,0.85)" }} />
      <FloatingSuits reduced={settings.reducedMotion} />
      <ChipOrbit reduced={settings.reducedMotion} />

      <motion.div
        initial={{ opacity: 0, y: settings.reducedMotion ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: settings.reducedMotion ? 0.2 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relative inline-block mb-2"
          >
            <span className="absolute inset-0 blur-2xl bg-amber-400/20 rounded-full scale-150" aria-hidden />
            <IconCards size={40} className="relative text-amber-300" />
          </motion.div>

          <h1 className="relative font-serif text-5xl sm:text-6xl font-black tracking-tight leading-none">
            <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_20px_rgba(245,158,11,0.35)]">
              Poker Night
            </span>
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2 text-white/30 text-[11px] font-mono tracking-widest">
            {SUITS.map((s, i) => (
              <span key={i} className={i % 2 === 0 ? "text-rose-400/50" : "text-white/25"}>
                {s}
              </span>
            ))}
          </div>
          <p className="text-white/45 text-sm mt-3 font-serif italic">
            Texas Hold&apos;em &amp; PLO4 — com amigos, ou sozinho contra o computador.
          </p>
        </div>

        {lastSession && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => router.push(`/room/${lastSession.code}`)}
            className="w-full mb-4 flex items-center justify-between gap-3 bg-emerald-400/[0.08] hover:bg-emerald-400/[0.14] border border-emerald-400/25 rounded-2xl px-4 py-3 transition text-left"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>
                <span className="block text-sm font-semibold text-emerald-200">Voltar à mesa</span>
                <span className="block text-[11px] text-white/40 font-mono tracking-widest">{lastSession.code}</span>
              </span>
            </span>
            <span className="text-emerald-300/70 text-sm">→</span>
          </motion.button>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="relative bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[1.75rem] p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
        >
          <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] border border-white/[0.06] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

          {/* segmented tabs: friends (gold) vs. bot (neutral silver) — distinct accent
              per mode so it visually reads as two different experiences, not one
              crowded form, while staying inside the app's gold/neutral palette */}
          <div className="relative flex gap-1 p-1 mb-1">
            <button
              onClick={() => setMode("friends")}
              className={`relative flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                mode === "friends" ? "text-slate-900" : "text-white/50 hover:text-white/80"
              }`}
            >
              {mode === "friends" && (
                <motion.span
                  layoutId="home-tab-bg"
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500"
                />
              )}
              <span className="relative">♠ Com Amigos</span>
            </button>
            <button
              onClick={() => setMode("bot")}
              className={`relative flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                mode === "bot" ? "text-slate-900" : "text-white/50 hover:text-white/80"
              }`}
            >
              {mode === "bot" && (
                <motion.span
                  layoutId="home-tab-bg"
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-slate-300 to-slate-400"
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                <IconBot size={16} /> Contra Bot
              </span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === "friends" ? (
              <motion.div
                key="friends"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-3 p-5 sm:p-6 pt-3"
              >
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setCreateOpen(true)}
                  className="group relative w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-900 font-bold shadow-[0_10px_30px_-8px_rgba(245,158,11,0.6)] overflow-hidden"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                  <span className="relative text-base">♠ Criar Mesa</span>
                </motion.button>

                {canQuickCreate && (
                  <button
                    onClick={handleQuickCreate}
                    disabled={quickBusy}
                    className="text-[11px] text-white/40 hover:text-[var(--gold-bright)] transition disabled:opacity-50 -mt-1"
                  >
                    {quickBusy ? (
                      "A criar..."
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <IconZap size={12} /> Rápido — usar últimas definições
                      </span>
                    )}
                  </button>
                )}
                {quickError && <div className="text-[var(--danger)] text-xs -mt-1">{quickError}</div>}

                <div className="flex items-center gap-3 my-1">
                  <span className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] uppercase tracking-widest text-white/25">ou</span>
                  <span className="flex-1 h-px bg-white/10" />
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setJoinOpen(true)}
                  className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/40 text-white/80 font-semibold transition"
                >
                  Entrar em Sala
                </motion.button>

                <div className="flex items-center justify-center gap-4 mt-2 text-white/30 text-[11px]">
                  <span className="flex items-center gap-1">
                    <IconZap size={12} /> Tempo real
                  </span>
                  <span className="w-1 h-1 rounded-full bg-white/15" />
                  <span className="flex items-center gap-1">
                    <IconGift size={12} /> 100% grátis
                  </span>
                  <span className="w-1 h-1 rounded-full bg-white/15" />
                  <span className="flex items-center gap-1">
                    <IconSmartphone size={12} /> Qualquer dispositivo
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="bot"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-3 p-5 sm:p-6 pt-3"
              >
                <p className="text-center text-white/40 text-xs -mt-1 mb-1">
                  Treina sozinho contra um oponente artificial — escolhe a dificuldade.
                </p>

                <input
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  maxLength={20}
                  placeholder="O teu nome"
                  aria-label="O teu nome"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-white/40 transition"
                />

                <div className="flex flex-col gap-2">
                  {(
                    [
                      { id: "easy", label: "Fácil", desc: "Chama muito, quase nunca sobe — ideal para aprender", Icon: IconLeaf },
                      { id: "medium", label: "Médio", desc: "Joga sólido: respeita pot odds, blefa às vezes", Icon: IconSwords },
                      { id: "hard", label: "Difícil", desc: "Estilo profissional: agressivo, blefa, joga por posição", Icon: IconFlame },
                    ] as const
                  ).map((d) => (
                    <motion.button
                      key={d.id}
                      whileTap={{ scale: 0.98 }}
                      disabled={!!botBusy}
                      onClick={() => handlePlayVsBot(d.id)}
                      className="group relative flex items-center gap-3 w-full text-left py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                    >
                      <d.Icon size={22} className="shrink-0 text-white/70" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-white/85 group-hover:text-white">
                          {d.label}
                        </span>
                        <span className="block text-[11px] text-white/40 truncate">{d.desc}</span>
                      </span>
                      <span className="text-white/50 text-sm shrink-0">
                        {botBusy === d.id ? "…" : "→"}
                      </span>
                    </motion.button>
                  ))}
                </div>
                {botError && <div className="text-[var(--danger)] text-xs text-center">{botError}</div>}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {allSessions.length > 0 && (
          <div className="mt-3 text-center">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="text-[11px] text-white/25 hover:text-white/50 transition underline underline-offset-2"
            >
              {historyOpen ? "Esconder" : "Ver"} o meu histórico ({allSessions.length})
            </button>
            {historyOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex flex-col gap-1.5 max-h-56 overflow-y-auto text-left"
              >
                {allSessions.map((s) => (
                  <button
                    key={s.code + (s.savedAt || 0)}
                    onClick={() => router.push(`/room/${s.code}`)}
                    className="flex items-center justify-between gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-xs transition"
                  >
                    <span className="text-white/60">
                      {s.name} <span className="text-white/30 font-mono">· {s.code}</span>
                    </span>
                    {s.savedAt && (
                      <span className="text-white/25 font-mono shrink-0">
                        {new Date(s.savedAt).toLocaleDateString("pt-PT")}
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
