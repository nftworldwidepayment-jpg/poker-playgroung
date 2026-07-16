"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, saveSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gameType, setGameType] = useState<"nlhe" | "plo4">("nlhe");
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [buyIn, setBuyIn] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) return setError("Escreve o teu nome");
    setLoading(true);
    setError("");
    try {
      const res = await api.createRoom(name.trim(), smallBlind, bigBlind, buyIn, gameType);
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
    <div className="flex-1 flex items-center justify-center relative overflow-hidden px-4 py-10">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.18), transparent), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(245,158,11,0.10), transparent), #04070a",
        }}
      />
      <div className="absolute inset-0 -z-10 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 26px)" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">♠️</div>
          <h1 className="font-serif text-4xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-amber-100 to-amber-300 bg-clip-text text-transparent">
            Poker Night
          </h1>
          <p className="text-white/50 text-sm mt-1 font-serif">Texas Hold&apos;em &amp; PLO4 em tempo real com os teus amigos</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-2xl">
          <div className="flex gap-1 bg-black/30 rounded-xl p-1 mb-5">
            <button
              onClick={() => setMode("create")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === "create" ? "bg-amber-500 text-slate-900" : "text-white/60 hover:text-white"
              }`}
            >
              Criar Sala
            </button>
            <button
              onClick={() => setMode("join")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === "join" ? "bg-amber-500 text-slate-900" : "text-white/60 hover:text-white"
              }`}
            >
              Entrar em Sala
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">O teu nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="Ex: João"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400/60 transition"
              />
            </div>

            {mode === "create" ? (
              <>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Variante</label>
                  <div className="flex gap-1 bg-black/30 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setGameType("nlhe")}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                        gameType === "nlhe" ? "bg-emerald-500 text-slate-900" : "text-white/60 hover:text-white"
                      }`}
                    >
                      Texas Hold&apos;em
                    </button>
                    <button
                      type="button"
                      onClick={() => setGameType("plo4")}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                        gameType === "plo4" ? "bg-emerald-500 text-slate-900" : "text-white/60 hover:text-white"
                      }`}
                    >
                      PLO4 (Omaha)
                    </button>
                  </div>
                  <p className="text-[11px] text-white/35 mt-1">
                    {gameType === "plo4"
                      ? "4 cartas na mão, usa exatamente 2 + 3 da mesa, apostas pot-limit."
                      : "2 cartas na mão, apostas no-limit — o clássico."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Small Blind</label>
                    <input
                      type="number"
                      min={1}
                      value={smallBlind}
                      onChange={(e) => setSmallBlind(Number(e.target.value))}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400/60"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Big Blind</label>
                    <input
                      type="number"
                      min={2}
                      value={bigBlind}
                      onChange={(e) => setBigBlind(Number(e.target.value))}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400/60"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Fichas iniciais</label>
                  <input
                    type="number"
                    min={bigBlind * 10}
                    value={buyIn}
                    onChange={(e) => setBuyIn(Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400/60"
                  />
                </div>
                {error && <div className="text-rose-400 text-sm">{error}</div>}
                <button
                  disabled={loading}
                  onClick={handleCreate}
                  className="mt-1 w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-bold shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
                >
                  {loading ? "A criar..." : "Criar mesa"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Código da sala</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={5}
                    placeholder="Ex: A7K2P"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400/60 tracking-widest font-mono uppercase"
                  />
                </div>
                {error && <div className="text-rose-400 text-sm">{error}</div>}
                <button
                  disabled={loading}
                  onClick={handleJoin}
                  className="mt-1 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-900 font-bold shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
                >
                  {loading ? "A entrar..." : "Entrar na mesa"}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Cria uma sala, partilha o código com os amigos e joguem juntos — em qualquer dispositivo.
        </p>
      </motion.div>
    </div>
  );
}
