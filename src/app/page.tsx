"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api, saveSession } from "@/lib/api";
import { Splash } from "@/components/Splash";
import { SettingsModal } from "@/components/SettingsModal";

const BLIND_PRESETS = [
  { label: "10 / 20", sb: 10, bb: 20 },
  { label: "25 / 50", sb: 25, bb: 50 },
  { label: "50 / 100", sb: 50, bb: 100 },
  { label: "100 / 200", sb: 100, bb: 200 },
];

const BUYIN_MULTIPLES = [50, 100, 200];

const SUITS = ["♠", "♥", "♦", "♣"];

function MiniCardBacks({ count }: { count: number }) {
  return (
    <div className="flex -space-x-2.5 mb-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-4 h-5 rounded-[3px] bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 border border-amber-100/40 shadow-sm"
          style={{ zIndex: count - i }}
        />
      ))}
    </div>
  );
}

function FloatingSuits() {
  const items = [
    { s: "♠", x: "6%", y: "14%", size: 34, dur: 9, delay: 0 },
    { s: "♦", x: "88%", y: "10%", size: 26, dur: 11, delay: 1.2 },
    { s: "♣", x: "12%", y: "78%", size: 30, dur: 10, delay: 0.6 },
    { s: "♥", x: "90%", y: "72%", size: 24, dur: 8, delay: 1.8 },
    { s: "♠", x: "50%", y: "6%", size: 18, dur: 12, delay: 2.4 },
    { s: "♣", x: "80%", y: "42%", size: 20, dur: 9.5, delay: 0.3 },
  ];
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

function ChipOrbit() {
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
          animate={{ opacity: 0.9, y: [0, -10, 0], rotate: c.rotate }}
          transition={{
            opacity: { duration: 0.8, delay: c.delay },
            y: { duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: c.delay },
            rotate: { duration: 0.8, delay: c.delay },
          }}
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
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gameType, setGameType] = useState<"nlhe" | "plo4">("nlhe");
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [buyIn, setBuyIn] = useState(1000);
  const [runItTwice, setRunItTwice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  function applyBlindPreset(sb: number, bb: number) {
    setSmallBlind(sb);
    setBigBlind(bb);
    setBuyIn(bb * 50);
  }

  async function handleCreate() {
    if (!name.trim()) return setError("Escreve o teu nome");
    setLoading(true);
    setError("");
    try {
      const res = await api.createRoom(name.trim(), smallBlind, bigBlind, buyIn, gameType, runItTwice);
      saveSession({ code: res.code, playerId: res.playerId, token: res.token, name: name.trim() });
      router.push(`/room/${res.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar sala");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError("Escreve o teu nome");
    if (!code.trim()) return setError("Escreve o código da sala");
    setLoading(true);
    setError("");
    try {
      const res = await api.joinRoom(code.trim(), name.trim());
      saveSession({ code: res.code, playerId: res.playerId, token: res.token, name: name.trim() });
      router.push(`/room/${res.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao entrar na sala");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden px-4 py-10 sm:py-14">
      <Splash />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-[var(--gold)]/40 transition flex items-center justify-center"
        title="Definições"
        aria-label="Definições"
      >
        ⚙
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
      <div
        className="absolute inset-0 -z-10"
        style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,0.85)" }}
      />
      <FloatingSuits />
      <ChipOrbit />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 160, damping: 14 }}
            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-semibold mb-3 border border-amber-400/20 rounded-full px-3 py-1 bg-amber-400/[0.04]"
          >
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            Tempo real · Grátis · Com os amigos
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
            Texas Hold&apos;em &amp; PLO4 em tempo real — a tua mesa, os teus amigos, em qualquer lugar.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="relative bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[1.75rem] p-6 sm:p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
        >
          <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] border border-white/[0.06] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

          <div className="relative flex gap-1 bg-black/40 rounded-2xl p-1 mb-6 border border-white/5">
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="absolute inset-y-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 shadow-[0_4px_16px_rgba(245,158,11,0.4)]"
              style={{ left: mode === "create" ? 4 : "calc(50% + 0px)" }}
            />
            <button
              onClick={() => setMode("create")}
              className={`relative z-10 flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                mode === "create" ? "text-slate-900" : "text-white/50 hover:text-white/80"
              }`}
            >
              Criar Sala
            </button>
            <button
              onClick={() => setMode("join")}
              className={`relative z-10 flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                mode === "join" ? "text-slate-900" : "text-white/50 hover:text-white/80"
              }`}
            >
              Entrar em Sala
            </button>
          </div>

          <div className="flex flex-col gap-3.5">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5 block font-semibold">
                O teu nome
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-sm">👤</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  placeholder="Ex: João"
                  className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-3 py-3 outline-none focus:border-amber-400/60 focus:bg-black/40 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)] transition placeholder:text-white/20"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {mode === "create" ? (
                <motion.div
                  key="create"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-3.5"
                >
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5 block font-semibold">
                      Variante
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGameType("nlhe")}
                        className={`relative overflow-hidden rounded-xl border p-3 text-left transition ${
                          gameType === "nlhe"
                            ? "border-emerald-400/60 bg-emerald-400/[0.08] shadow-[0_0_0_1px_rgba(52,211,153,0.3)]"
                            : "border-white/10 bg-black/20 hover:bg-black/30"
                        }`}
                      >
                        <MiniCardBacks count={2} />
                        <div className="text-sm font-bold text-white/90">Hold&apos;em</div>
                        <div className="text-[10px] text-white/40">2 cartas · no-limit</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGameType("plo4")}
                        className={`relative overflow-hidden rounded-xl border p-3 text-left transition ${
                          gameType === "plo4"
                            ? "border-emerald-400/60 bg-emerald-400/[0.08] shadow-[0_0_0_1px_rgba(52,211,153,0.3)]"
                            : "border-white/10 bg-black/20 hover:bg-black/30"
                        }`}
                      >
                        <MiniCardBacks count={4} />
                        <div className="text-sm font-bold text-white/90">PLO4</div>
                        <div className="text-[10px] text-white/40">4 cartas · pot-limit</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5 block font-semibold">
                      Stakes
                    </label>
                    <div className="flex gap-1.5 mb-2">
                      {BLIND_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => applyBlindPreset(p.sb, p.bb)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition ${
                            smallBlind === p.sb && bigBlind === p.bb
                              ? "bg-amber-500/90 text-slate-900 border-amber-300"
                              : "bg-black/20 hover:bg-black/30 text-white/60 border-white/10"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-white/35 mb-1 block">Small Blind</span>
                        <input
                          type="number"
                          min={1}
                          value={smallBlind}
                          onChange={(e) => setSmallBlind(Number(e.target.value))}
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/60 font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-white/35 mb-1 block">Big Blind</span>
                        <input
                          type="number"
                          min={2}
                          value={bigBlind}
                          onChange={(e) => setBigBlind(Number(e.target.value))}
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/60 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5 block font-semibold">
                      Fichas iniciais
                    </label>
                    <div className="flex gap-1.5 mb-2">
                      {BUYIN_MULTIPLES.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setBuyIn(bigBlind * m)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition ${
                            buyIn === bigBlind * m
                              ? "bg-amber-500/90 text-slate-900 border-amber-300"
                              : "bg-black/20 hover:bg-black/30 text-white/60 border-white/10"
                          }`}
                        >
                          {m}BB
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={bigBlind * 10}
                      value={buyIn}
                      onChange={(e) => setBuyIn(Number(e.target.value))}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400/60 font-mono"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 bg-black/20 border border-white/10 rounded-xl px-3.5 py-3 cursor-pointer hover:bg-black/30 transition">
                    <input
                      type="checkbox"
                      checked={runItTwice}
                      onChange={(e) => setRunItTwice(e.target.checked)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span className="text-sm text-white/70">
                      Run It Twice{" "}
                      <span className="text-white/35 text-xs block sm:inline">
                        divide o pote em duas mesas quando todos vão all-in
                      </span>
                    </span>
                  </label>

                  {error && <div className="text-rose-400 text-sm">{error}</div>}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={loading}
                    onClick={handleCreate}
                    className="group relative mt-1 w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-900 font-bold shadow-[0_10px_30px_-8px_rgba(245,158,11,0.6)] overflow-hidden disabled:opacity-50"
                  >
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    <span className="relative">{loading ? "A criar mesa..." : "♠ Criar mesa"}</span>
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-3.5"
                >
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5 block font-semibold">
                      Código da sala
                    </label>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      maxLength={5}
                      placeholder="A7K2P"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3.5 outline-none focus:border-amber-400/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)] tracking-[0.4em] font-mono uppercase text-center text-lg"
                    />
                  </div>
                  {error && <div className="text-rose-400 text-sm">{error}</div>}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={loading}
                    onClick={handleJoin}
                    className="group relative mt-1 w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 text-slate-900 font-bold shadow-[0_10px_30px_-8px_rgba(16,185,129,0.6)] overflow-hidden disabled:opacity-50"
                  >
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    <span className="relative">{loading ? "A entrar..." : "Entrar na mesa"}</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="flex items-center justify-center gap-4 mt-6 text-white/30 text-[11px]">
          <span className="flex items-center gap-1">⚡ Tempo real</span>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <span className="flex items-center gap-1">🎁 100% grátis</span>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <span className="flex items-center gap-1">📱 Qualquer dispositivo</span>
        </div>
      </motion.div>
    </div>
  );
}
