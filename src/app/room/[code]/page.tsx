"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { api, loadSession, saveSession, Session } from "@/lib/api";
import { useRoom } from "@/lib/useRoom";
import { PokerTable } from "@/components/PokerTable";
import { ActionBar } from "@/components/ActionBar";
import { WinnerOverlay } from "@/components/WinnerOverlay";
import { ToastStack, ToastItem } from "@/components/Toast";
import { playCheck, playDeal, playFold, playTurn, playWin, setSoundEnabled } from "@/lib/sounds";

let toastSeq = 0;

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const router = useRouter();

  const { room, players, loading } = useRoom(code);
  const [session, setSession] = useState<Session | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [holeCards, setHoleCards] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [soundOn, setSoundOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showWinner, setShowWinner] = useState(false);
  const [handHistory, setHandHistory] = useState<
    { handNumber: number; board: string[]; winners: { name: string; amount: number; hand?: string }[] }[]
  >([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const lastActionKey = useRef<string>("");
  const lastHandFetched = useRef<number>(-1);
  const lastBoardLenBeforeShowdown = useRef<number>(0);
  const lastLoggedHand = useRef<number>(-1);

  function pushToast(message: string, tone: "error" | "info" = "error") {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }

  useEffect(() => {
    setSession(loadSession(code));
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // enforce timeouts client-side (any connected client can trigger the check)
  useEffect(() => {
    if (!room?.turn_expires_at) return;
    const t = setInterval(() => {
      api.timeout(code).catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [code, room?.turn_expires_at]);

  const you = useMemo(() => players.find((p) => p.id === session?.playerId) || null, [players, session]);
  const isHost = !!you?.is_host;

  // fetch our hole cards whenever a new hand starts
  useEffect(() => {
    if (!session || !room) return;
    if (room.status !== "playing") return;
    if (lastHandFetched.current === room.hand_number) return;
    lastHandFetched.current = room.hand_number;
    api
      .hand(code, session.playerId, session.token)
      .then((r) => {
        setHoleCards(r.cards);
        if (r.cards.length) playDeal();
      })
      .catch(() => {});
  }, [code, session, room?.hand_number, room?.status]);

  // sound reactions
  useEffect(() => {
    if (!room?.last_action) return;
    const key = `${room.hand_number}-${room.last_action.seat}-${room.last_action.action}-${room.pot}`;
    if (lastActionKey.current === key) return;
    lastActionKey.current = key;
    if (room.last_action.action === "fold") playFold();
    else if (room.last_action.action === "check") playCheck();
  }, [room?.last_action, room?.hand_number, room?.pot]);

  // track the board length right up until showdown, so we know how many
  // community cards still need to flip open (an all-in run-out can resolve
  // flop+turn+river in one server update, so this can jump by more than one)
  useEffect(() => {
    if (room && room.phase !== "showdown") {
      lastBoardLenBeforeShowdown.current = room.community_cards.length;
    }
  }, [room?.phase, room?.community_cards.length]);

  // showdown reveal: wait for the board to finish flipping (matching
  // PokerTable's staggered reveal pace) before popping the winner overlay
  useEffect(() => {
    if (room?.phase === "showdown" && (room.winners?.length || 0) > 0) {
      const cardsStillFlipping = Math.max(0, room.community_cards.length - lastBoardLenBeforeShowdown.current);
      const delay = 500 + cardsStillFlipping * 650 + 400;
      const t = setTimeout(() => {
        setShowWinner(true);
        playWin();
      }, delay);
      return () => clearTimeout(t);
    }
    setShowWinner(false);
  }, [room?.phase, room?.winners, room?.hand_number]);

  // keep a small client-side log of recent finished hands for the history popover
  useEffect(() => {
    if (!room || room.phase !== "showdown" || !room.winners?.length) return;
    if (lastLoggedHand.current === room.hand_number) return;
    lastLoggedHand.current = room.hand_number;
    setHandHistory((h) =>
      [
        {
          handNumber: room.hand_number,
          board: room.community_cards,
          winners: room.winners!.map((w) => ({ name: w.name, amount: w.amount, hand: w.hand })),
        },
        ...h,
      ].slice(0, 5)
    );
  }, [room?.phase, room?.winners, room?.hand_number, room?.community_cards]);

  useEffect(() => {
    if (room && you && room.current_turn_seat === you.seat) playTurn();
  }, [room?.current_turn_seat]);

  async function handleJoin() {
    if (!joinName.trim()) return setJoinError("Escreve o teu nome");
    setJoining(true);
    setJoinError("");
    try {
      const res = await api.joinRoom(code, joinName.trim());
      const s: Session = { code, playerId: res.playerId, token: res.token, name: joinName.trim() };
      saveSession(s);
      setSession(s);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Erro ao entrar");
    } finally {
      setJoining(false);
    }
  }

  async function handleStart() {
    if (!session) return;
    setBusy(true);
    try {
      await api.startHand(code, session.playerId, session.token);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao iniciar");
    } finally {
      setBusy(false);
    }
  }

  async function handleShowHand() {
    if (!session) return;
    try {
      await api.showHand(code, session.playerId, session.token);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Não foi possível mostrar a mão");
    }
  }

  async function handleToggleStraddle() {
    if (!session || !you) return;
    try {
      await api.toggleStraddle(session.playerId, session.token, !you.auto_straddle);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao alterar straddle");
    }
  }

  async function handleToggleRunItTwice() {
    if (!session || !room) return;
    try {
      await api.toggleRunItTwice(code, session.playerId, session.token, !room.run_it_twice_enabled);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao alterar Run It Twice");
    }
  }

  async function handleAction(action: string, amount?: number) {
    if (!session) return;
    setBusy(true);
    try {
      await api.action(code, session.playerId, session.token, action, amount);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Ação inválida");
    } finally {
      setBusy(false);
    }
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  function copyInvite() {
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      pushToast("Link copiado!", "info");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const timerPct = room?.turn_expires_at
    ? Math.max(0, Math.min(1, (new Date(room.turn_expires_at).getTime() - now) / 30000))
    : 0;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/50">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-amber-400/15" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-lg">🃏</div>
        </div>
        <div className="text-sm font-serif tracking-wide">A carregar mesa...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
        <div className="text-2xl font-bold">Sala não encontrada</div>
        <button onClick={() => router.push("/")} className="text-amber-400 underline">
          Voltar ao início
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="text-center mb-4">
            <div className="text-3xl mb-1">🃏</div>
            <div className="text-lg font-bold">Entrar na sala {code}</div>
          </div>
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            maxLength={20}
            placeholder="O teu nome"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400/60 mb-3"
          />
          {joinError && <div className="text-rose-400 text-sm mb-2">{joinError}</div>}
          <button
            disabled={joining}
            onClick={handleJoin}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-bold shadow-lg disabled:opacity-50"
          >
            {joining ? "A entrar..." : "Entrar"}
          </button>
        </div>
      </div>
    );
  }

  const yourTurn = !!you && room.current_turn_seat === you.seat && you.status === "active";

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(16,185,129,0.12), transparent), #04070a",
        }}
      />

      <ToastStack toasts={toasts} />

      <div className="flex items-center justify-between px-3 py-3 z-20 gap-2">
        <button onClick={() => router.push("/")} className="text-white/50 hover:text-white text-sm shrink-0 py-1.5 px-1">
          ← Sair
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-amber-300/60 font-serif border border-amber-400/20 rounded-full px-2 py-1">
            {room.game_type === "plo4" ? "PLO4" : "Hold'em"}
          </span>
          <button
            onClick={copyInvite}
            className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-sm font-mono tracking-widest hover:border-amber-400/50 transition"
          >
            {code} {copied ? "✓" : "📋"}
          </button>
        </div>
        <div className="flex items-center gap-1 shrink-0 relative">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            disabled={handHistory.length === 0}
            className="text-white/50 hover:text-white text-lg py-1.5 px-1 disabled:opacity-30"
            title="Histórico de mãos"
          >
            📜
          </button>
          <button onClick={toggleSound} className="text-white/50 hover:text-white text-lg py-1.5 px-1">
            {soundOn ? "🔊" : "🔇"}
          </button>
          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute top-10 right-0 z-30 w-64 bg-slate-900/95 backdrop-blur border border-amber-400/20 rounded-xl p-3 shadow-2xl"
              >
                <div className="text-[10px] uppercase tracking-widest text-amber-300/60 font-semibold mb-2">
                  Últimas mãos
                </div>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {handHistory.map((h) => (
                    <div key={h.handNumber} className="text-xs border-b border-white/5 pb-2 last:border-0">
                      <div className="text-white/40 font-mono mb-0.5">Mão #{h.handNumber}</div>
                      {h.winners.map((w, i) => (
                        <div key={i} className="text-amber-200">
                          {w.name} +{w.amount.toLocaleString("pt-PT")}
                          {w.hand && <span className="text-white/40"> · {w.hand}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-2 pb-40">
        <PokerTable
          room={room}
          players={players}
          youId={session.playerId}
          holeCards={room.status === "playing" ? holeCards : []}
          timerPct={timerPct}
        />

        {room.status === "waiting" && (
          <div className="mt-6 flex flex-col items-center gap-2 text-center">
            <div className="text-white/60 text-sm">
              {players.length} jogador{players.length === 1 ? "" : "es"} na sala — partilha o código{" "}
              <span className="font-mono text-amber-300">{code}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {you && (
                <label className="flex items-center gap-1.5 text-white/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={you.auto_straddle}
                    onChange={handleToggleStraddle}
                    className="accent-amber-500 w-3.5 h-3.5"
                  />
                  Straddle automático
                </label>
              )}
              {isHost && (
                <label className="flex items-center gap-1.5 text-white/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={room.run_it_twice_enabled}
                    onChange={handleToggleRunItTwice}
                    className="accent-amber-500 w-3.5 h-3.5"
                  />
                  Run It Twice
                </label>
              )}
            </div>
            {isHost ? (
              <button
                disabled={busy || players.length < 2}
                onClick={handleStart}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-bold shadow-lg disabled:opacity-40"
              >
                {players.length < 2 ? "À espera de mais jogadores..." : "Começar Jogo"}
              </button>
            ) : (
              <div className="text-white/40 text-sm">À espera que o anfitrião comece o jogo...</div>
            )}
          </div>
        )}
      </div>

      {room.phase === "showdown" && showWinner && (
        <WinnerOverlay
          room={room}
          isHost={isHost}
          onNext={handleStart}
          busy={busy}
          canShowHand={!!you && holeCards.length > 0 && !room.revealed_hands?.some((r) => r.playerId === you.id)}
          onShowHand={handleShowHand}
        />
      )}

      {yourTurn && you && room.phase !== "showdown" && (
        <ActionBar room={room} you={you} onAction={handleAction} busy={busy} />
      )}
    </div>
  );
}
