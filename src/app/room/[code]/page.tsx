"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const lastActionKey = useRef<string>("");
  const lastHandFetched = useRef<number>(-1);

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

  // showdown reveal with a short cinematic suspense delay before the winner overlay appears
  useEffect(() => {
    if (room?.phase === "showdown" && (room.winners?.length || 0) > 0) {
      const t = setTimeout(() => {
        setShowWinner(true);
        playWin();
      }, 650);
      return () => clearTimeout(t);
    }
    setShowWinner(false);
  }, [room?.phase, room?.winners, room?.hand_number]);

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
    return <div className="flex-1 flex items-center justify-center text-white/50">A carregar mesa...</div>;
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
        <button onClick={toggleSound} className="text-white/50 hover:text-white text-lg shrink-0 py-1.5 px-1">
          {soundOn ? "🔊" : "🔇"}
        </button>
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
        <WinnerOverlay room={room} isHost={isHost} onNext={handleStart} busy={busy} />
      )}

      {yourTurn && you && room.phase !== "showdown" && (
        <ActionBar room={room} you={you} onAction={handleAction} busy={busy} />
      )}
    </div>
  );
}
