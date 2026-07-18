"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ApiError } from "@/lib/api";
import { useSettings } from "@/lib/settings";

export function JoinRoomModal({
  open,
  onClose,
  onJoin,
  defaultName,
}: {
  open: boolean;
  onClose: () => void;
  onJoin: (code: string, name: string, password?: string) => Promise<void>;
  defaultName: string;
}) {
  const [settings] = useSettings();
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setCode("");
      setPassword("");
      setNeedsPassword(false);
      setError("");
    }
  }, [open, defaultName]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  async function submit() {
    if (!name.trim()) return setError("Escreve o teu nome");
    if (!code.trim()) return setError("Escreve o código da sala");
    setBusy(true);
    setError("");
    try {
      await onJoin(code.trim(), name.trim(), password || undefined);
    } catch (e) {
      if (e instanceof ApiError && e.requiresPassword) setNeedsPassword(true);
      setError(e instanceof Error ? e.message : "Erro ao entrar na sala");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: settings.reducedMotion ? 1 : 0.96, y: settings.reducedMotion ? 0 : 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: settings.reducedMotion ? 0.15 : 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] p-6 sm:p-7"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)), #0a0e12",
          backdropFilter: "blur(24px)",
        }}
      >
        <div className="sm:hidden flex justify-center -mt-2 mb-3">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-start justify-between mb-5">
          <h2 className="font-serif text-2xl font-bold text-white/95">Entrar em Sala</h2>
          <button
            onClick={() => !busy && onClose()}
            aria-label="Fechar"
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-[11px] text-white/40 mb-1 block">O teu nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="Ex: João"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--gold)]/60 transition placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1 block">Código da sala</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={5}
              placeholder="A7K2P"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[var(--gold)]/60 tracking-[0.4em] font-mono uppercase text-center text-lg"
            />
          </div>
          {needsPassword && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <label className="text-[11px] text-white/40 mb-1 block">Palavra-passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mesa privada"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-[var(--gold)]/60 transition"
              />
            </motion.div>
          )}
          {error && <div className="text-[var(--danger)] text-sm">{error}</div>}
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={busy}
            onClick={submit}
            className="group relative mt-1 w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 text-slate-900 font-bold shadow-[0_10px_30px_-8px_rgba(16,185,129,0.6)] overflow-hidden disabled:opacity-50"
          >
            <span className="relative">{busy ? "A entrar..." : "Entrar na mesa"}</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
