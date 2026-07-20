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
import { SettingsModal } from "@/components/SettingsModal";
import { PlayerNoteEditor } from "@/components/PlayerNoteEditor";
import { Glossary } from "@/components/Glossary";
import { useSettings } from "@/lib/settings";
import { handStrengthLabel } from "@/lib/handStrength";
import { loadNotes, saveNote, PlayerNote, TAG_META } from "@/lib/notes";
import {
  playAllIn,
  playCheck,
  playChip,
  playCountdownTick,
  playDeal,
  playFold,
  playRaise,
  playShuffle,
  playTurn,
  playWin,
  playYourAction,
  setSoundEnabled,
} from "@/lib/sounds";
import {
  IconArmchair,
  IconArrowLeft,
  IconBarChart,
  IconCards,
  IconCheck,
  IconClipboard,
  IconDownload,
  IconHelpCircle,
  IconHistory,
  IconPause,
  IconPlay,
  IconSettings,
  IconVolume2,
  IconVolumeX,
} from "@/components/icons";

let toastSeq = 0;

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const { room, players, loading, connectedIds, emotes, sendEmote } = useRoom(code, session?.playerId);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [holeCards, setHoleCards] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [settings, updateSettings] = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showWinner, setShowWinner] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [handHistory, setHandHistory] = useState<
    { handNumber: number; board: string[]; winners: { name: string; amount: number; hand?: string }[] }[]
  >([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [biggestPot, setBiggestPot] = useState(0);
  const [initialChips, setInitialChips] = useState<Record<string, number>>({});
  const [preAction, setPreAction] = useState<"fold" | "check_call" | null>(null);
  const [notes, setNotes] = useState<Record<string, PlayerNote>>({});
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const lastActionKey = useRef<string>("");
  const lastHandFetched = useRef<number>(-1);
  const lastBoardLenBeforeShowdown = useRef<number>(0);
  const lastLoggedHand = useRef<number>(-1);
  const lastStatsHand = useRef<number>(-1);

  function pushToast(message: string, tone: "error" | "info" = "error") {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }

  useEffect(() => {
    setSession(loadSession(code));
    setNotes(loadNotes(code));
  }, [code]);

  function handleNoteChange(playerId: string, note: PlayerNote) {
    setNotes((n) => ({ ...n, [playerId]: note }));
    saveNote(code, playerId, note);
  }

  // keep the audio engine in sync with the persisted sound preference
  useEffect(() => {
    setSoundEnabled(settings.sound);
  }, [settings.sound]);

  // enforce timeouts client-side (any connected client can trigger the check)
  useEffect(() => {
    if (!room?.turn_expires_at) return;
    const t = setInterval(() => {
      api.timeout(code).catch(() => {});
    }, 1200);
    return () => clearInterval(t);
  }, [code, room?.turn_expires_at]);

  // the current actor, as a stable primitive pair rather than the whole
  // `players` array — every action anywhere in the hand re-writes every
  // player row (saveCtx updates all of them, chips or not), which fires a
  // Realtime UPDATE for each one and hands useRoom a brand-new `players`
  // array; keying the bot-tick effect off that array meant an unrelated
  // ripple (e.g. someone toggling sit-out for next hand) could tear down and
  // re-arm the "think" timer before it ever fired, stalling a bot's turn.
  const actor = players.find((p) => p.seat === room?.current_turn_seat);
  const actorId = actor?.id ?? null;
  const actorIsBot = !!actor?.is_bot;
  const actorBotDifficulty = actor?.bot_difficulty ?? null;

  // when it's a bot's turn, let it "think" for a beat (same thinking-dots
  // animation a human would trigger) then have any connected client ask the
  // server to compute and apply its move — the decision itself runs entirely
  // server-side in bot_tick, this is just the trigger. Harder bots pause a
  // little longer, as if actually working through the equity math; easy
  // bots snap-decide, matching their "calling station" profile.
  useEffect(() => {
    if (!room || room.status !== "playing" || !actorIsBot) return;
    const base = actorBotDifficulty === "hard" ? 1000 : actorBotDifficulty === "easy" ? 500 : 700;
    const jitter = actorBotDifficulty === "hard" ? 1300 : 900;
    const delay = base + Math.random() * jitter;
    const t = setTimeout(() => {
      api.botTick(code).catch(() => {});
    }, delay);
    return () => clearTimeout(t);
  }, [code, actorId, actorIsBot, actorBotDifficulty, room?.status]);

  // a backgrounded/locked phone throttles or fully suspends JS timers, so the
  // interval-based timeout/bot-tick nudges above can silently stop firing —
  // catch back up the instant the tab is foregrounded again instead of
  // waiting for the next scheduled tick (which can be seconds away).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      api.timeout(code).catch(() => {});
      api.botTick(code).catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [code]);

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
        if (r.cards.length) {
          playShuffle();
          playDeal();
        }
      })
      .catch(() => {});
  }, [code, session, room?.hand_number, room?.status]);

  // sound reactions — raise and all-in each get their own distinct sound
  // instead of sharing the plain "call" clink, so a bet size jump is
  // audible without needing to look at the screen.
  useEffect(() => {
    if (!room?.last_action) return;
    const key = `${room.hand_number}-${room.last_action.seat}-${room.last_action.action}-${room.pot}`;
    if (lastActionKey.current === key) return;
    lastActionKey.current = key;
    if (room.last_action.action === "fold") playFold();
    else if (room.last_action.action === "check") playCheck();
    else if (room.last_action.action === "raise") playRaise();
    else if (room.last_action.action === "all_in") playAllIn();
    else if (room.last_action.action === "call") playChip();
  }, [room?.last_action, room?.hand_number, room?.pot]);

  // a soft tick in the last 3 seconds of your own turn — deliberately not
  // tied to the visual TurnRing's own 200ms interval (that stays isolated in
  // Seat.tsx), this just watches the same deadline from the page level since
  // it needs to fire once per second, not four times.
  useEffect(() => {
    if (!room?.turn_expires_at || !you || room.current_turn_seat !== you.seat) return;
    const deadline = new Date(room.turn_expires_at).getTime();
    let lastTick = -1;
    const t = setInterval(() => {
      const secondsLeft = Math.ceil((deadline - Date.now()) / 1000);
      if (secondsLeft > 0 && secondsLeft <= 3 && secondsLeft !== lastTick) {
        lastTick = secondsLeft;
        playCountdownTick();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.turn_expires_at, room?.current_turn_seat, you?.seat]);

  // track the board length right up until showdown, so we know how many
  // community cards still need to flip open (an all-in run-out can resolve
  // flop+turn+river in one server update, so this can jump by more than one)
  useEffect(() => {
    if (room && room.phase !== "showdown") {
      lastBoardLenBeforeShowdown.current = room.community_cards.length;
    }
  }, [room?.phase, room?.community_cards.length]);

  // showdown reveal: wait for the board to finish flipping (matching
  // PokerTable's staggered reveal pace), then hold a deliberate "slow roll"
  // beat — the same suspense a real player gets by not tabling their winning
  // hand right away — before the winner overlay lands.
  useEffect(() => {
    if (room?.phase === "showdown" && (room.winners?.length || 0) > 0) {
      const cardsStillFlipping = Math.max(0, room.community_cards.length - lastBoardLenBeforeShowdown.current);
      const boardDelay = 500 + cardsStillFlipping * 650 + 300;
      const slowRollMs = settings.reducedMotion ? 0 : 950;
      const t1 = setTimeout(() => setRevealing(!settings.reducedMotion), boardDelay);
      const t2 = setTimeout(() => {
        setRevealing(false);
        setShowWinner(true);
        playWin();
      }, boardDelay + slowRollMs);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    setShowWinner(false);
    setRevealing(false);
  }, [room?.phase, room?.winners, room?.hand_number, settings.reducedMotion]);

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

  // baseline for the session stats panel: each player's chip count the first time
  // we see them (so "net" reflects wins/losses since they sat down, not since the
  // room was created — matters when someone joins mid-session)
  useEffect(() => {
    setInitialChips((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of players) {
        if (!(p.id in next)) {
          next[p.id] = p.chips;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [players]);

  // track the single biggest pot won this session, for the stats panel
  useEffect(() => {
    if (!room || room.phase !== "showdown" || !room.winners?.length) return;
    if (lastStatsHand.current === room.hand_number) return;
    lastStatsHand.current = room.hand_number;
    const total = room.winners.reduce((s, w) => s + w.amount, 0);
    setBiggestPot((b) => Math.max(b, total));
  }, [room?.phase, room?.winners, room?.hand_number]);

  useEffect(() => {
    if (room && you && room.current_turn_seat === you.seat) playTurn();
  }, [room?.current_turn_seat]);

  // keep the screen from auto-locking mid-hand — nothing kills the mood
  // faster than the phone dimming out while you're deciding a river call.
  // Unsupported browsers (and the OS itself, if the user overrides it) just
  // no-op; this never blocks anything if it fails.
  useEffect(() => {
    if (room?.status !== "playing" || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock
      .request("screen")
      .then((s) => {
        if (cancelled) s.release().catch(() => {});
        else sentinel = s;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sentinel?.release().catch(() => {});
    };
  }, [room?.status]);

  // pre-actions: queued while it's someone else's turn, fired the instant it becomes yours
  useEffect(() => {
    if (!room || !you || !session || !preAction) return;
    if (room.current_turn_seat !== you.seat || you.status !== "active" || room.phase === "showdown") return;
    const action = preAction;
    setPreAction(null);
    const toCall = room.current_bet - you.current_bet;
    api
      .action(code, session.playerId, session.token, action === "check_call" ? (toCall > 0 ? "call" : "check") : "fold")
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.current_turn_seat, room?.phase]);

  // clear any queued pre-action once the hand actually moves on
  useEffect(() => {
    setPreAction(null);
  }, [room?.hand_number, room?.phase]);

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

  async function handleToggleSitOut() {
    if (!session || !you) return;
    try {
      await api.toggleSitOut(session.playerId, session.token, !you.wants_sit_out);
      pushToast(
        you.wants_sit_out ? "Vais voltar a jogar na próxima mão" : "Vais sentar-te de fora a partir da próxima mão",
        "info"
      );
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao alterar estado");
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

  async function handleToggleRabbitHunt() {
    if (!session || !room) return;
    try {
      await api.toggleRabbitHunt(code, session.playerId, session.token, !room.rabbit_hunt_enabled);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao alterar Rabbit Hunt");
    }
  }

  async function handleTogglePause() {
    if (!session || !room) return;
    try {
      await api.togglePause(code, session.playerId, session.token, room.status !== "paused");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao pausar a mesa");
    }
  }

  async function handleKick(targetId: string) {
    if (!session) return;
    try {
      await api.kickPlayer(session.playerId, session.token, targetId);
      pushToast("Jogador removido", "info");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao remover jogador");
    }
  }

  function handleSendEmote(playerId: string, emoji: string) {
    sendEmote(playerId, emoji);
  }

  async function handleAddBot(difficulty: string) {
    if (!session) return;
    try {
      await api.addBot(session.playerId, session.token, difficulty);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao adicionar bot");
    }
  }

  async function handleSetBotDifficulty(targetId: string, difficulty: string) {
    if (!session) return;
    try {
      await api.setBotDifficulty(session.playerId, session.token, targetId, difficulty);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao mudar a dificuldade");
    }
  }

  async function handleAction(action: string, amount?: number) {
    if (!session) return;
    setBusy(true);
    playYourAction();
    try {
      await api.action(code, session.playerId, session.token, action, amount);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Ação inválida");
    } finally {
      setBusy(false);
    }
  }

  function toggleSound() {
    updateSettings({ sound: !settings.sound });
  }

  function copyInvite() {
    const url = `${window.location.origin}/room/${code}`;
    // on a phone, the native share sheet (WhatsApp, Messages, etc.) beats a
    // silent clipboard copy the friend still has to go paste somewhere —
    // fall back to copy on desktop or if the user cancels/it's unsupported
    if (navigator.share) {
      navigator
        .share({ title: "Poker Night", text: `Entra na minha mesa: ${code}`, url })
        .catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      pushToast("Link copiado!", "info");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // pulls the FULL server-side history (up to 50 hands) rather than just the
  // last 5 this tab happened to see live, and downloads it as JSON — the
  // server has kept every hand since the room was created (see hand_history
  // in db.ts), this just finally gives a way to get it out.
  async function exportHandHistory() {
    try {
      const { hands } = await api.handHistory(code, 50);
      if (!hands.length) {
        pushToast("Ainda não há mãos para exportar", "info");
        return;
      }
      const blob = new Blob([JSON.stringify(hands, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poker-night-${code}-mãos.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao exportar histórico", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/50">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-amber-400/15" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-amber-300">
            <IconCards size={20} />
          </div>
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
            <div className="flex justify-center mb-1 text-amber-300">
              <IconCards size={28} />
            </div>
            <div className="text-lg font-bold">Entrar na sala {code}</div>
          </div>
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            maxLength={20}
            placeholder="O teu nome"
                  aria-label="O teu nome"
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

      <div className="corner-vignette" />
      <ToastStack toasts={toasts} />

      <div className="flex items-center justify-between px-3 py-3 safe-top z-20 gap-2">
        <button
          onClick={() => router.push("/")}
          className="text-white/50 hover:text-white text-sm shrink-0 py-1.5 px-1 inline-flex items-center gap-1"
        >
          <IconArrowLeft size={14} /> Sair
        </button>
        <div className="flex items-center gap-2">
          {room.table_name && (
            <span className="hidden md:inline-block text-xs font-serif italic text-white/40 truncate max-w-[140px]">
              {room.table_name}
            </span>
          )}
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-amber-300/60 font-serif border border-amber-400/20 rounded-full px-2 py-1">
            {room.game_type === "plo4" ? "PLO4" : "Hold'em"}
          </span>
          {room.ante > 0 && (
            <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-white/40 font-mono border border-white/10 rounded-full px-2 py-1">
              Ante {room.ante}
            </span>
          )}
          <button
            onClick={copyInvite}
            className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-sm font-mono tracking-widest hover:border-amber-400/50 transition"
            title="Partilhar convite"
            aria-label="Partilhar convite para a sala"
          >
            {code}{" "}
            {copied ? (
              <span className="copy-check-pop inline-flex text-emerald-400">
                <IconCheck size={14} />
              </span>
            ) : (
              <IconClipboard size={14} />
            )}
          </button>
        </div>
        <div className="flex items-center gap-1 shrink-0 relative">
          {you && room.status !== "finished" && (
            <button
              onClick={handleToggleSitOut}
              className={`py-2 px-2 rounded-lg ${you.wants_sit_out ? "text-amber-300" : "text-white/50 hover:text-white"}`}
              title={you.wants_sit_out ? "Estou de volta" : "Sentar-me fora"}
              aria-label={you.wants_sit_out ? "Estou de volta" : "Sentar-me fora"}
            >
              <IconArmchair size={18} active={you.wants_sit_out} />
            </button>
          )}
          {isHost && (room.status === "playing" || room.status === "paused") && (
            <button
              onClick={handleTogglePause}
              className={`py-2 px-2 rounded-lg ${room.status === "paused" ? "text-amber-300" : "text-white/50 hover:text-white"}`}
              title={room.status === "paused" ? "Retomar mesa" : "Pausar mesa"}
              aria-label={room.status === "paused" ? "Retomar mesa" : "Pausar mesa"}
            >
              {room.status === "paused" ? <IconPlay size={18} /> : <IconPause size={18} />}
            </button>
          )}
          <button
            onClick={() => setGlossaryOpen(true)}
            className="text-white/50 hover:text-white py-2 px-2 rounded-lg"
            title="Glossário de poker"
            aria-label="Glossário de poker"
          >
            <IconHelpCircle size={18} />
          </button>
          <button
            onClick={() => setStatsOpen((v) => !v)}
            className="text-white/50 hover:text-white py-2 px-2 rounded-lg"
            title="Estatísticas da sessão"
            aria-label="Estatísticas da sessão"
          >
            <IconBarChart size={18} />
          </button>
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            disabled={handHistory.length === 0}
            className="text-white/50 hover:text-white py-2 px-2 rounded-lg disabled:opacity-30"
            title="Histórico de mãos"
            aria-label="Histórico de mãos"
          >
            <IconHistory size={18} />
          </button>
          <button
            onClick={toggleSound}
            className="text-white/50 hover:text-white py-2 px-2 rounded-lg"
            title={settings.sound ? "Desligar som" : "Ligar som"}
            aria-label={settings.sound ? "Desligar som" : "Ligar som"}
          >
            {settings.sound ? <IconVolume2 size={18} /> : <IconVolumeX size={18} />}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-white/50 hover:text-white py-2 px-2 rounded-lg"
            title="Definições"
            aria-label="Definições"
          >
            <IconSettings size={18} />
          </button>
          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute top-10 right-0 z-30 w-64 bg-slate-900/95 backdrop-blur border border-amber-400/20 rounded-xl p-3 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-amber-300/60 font-semibold">
                    Últimas mãos
                  </span>
                  <button
                    onClick={exportHandHistory}
                    className="text-white/40 hover:text-amber-200 transition"
                    title="Exportar histórico completo (JSON)"
                    aria-label="Exportar histórico completo"
                  >
                    <IconDownload size={13} />
                  </button>
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

          <AnimatePresence>
            {statsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute top-10 right-0 z-30 w-64 bg-slate-900/95 backdrop-blur border border-amber-400/20 rounded-xl p-3 shadow-2xl"
              >
                <div className="text-[10px] uppercase tracking-widest text-amber-300/60 font-semibold mb-2">
                  Estatísticas da sessão
                </div>
                <div className="flex justify-between text-xs text-white/50 mb-2 pb-2 border-b border-white/5">
                  <span>Mãos jogadas: {room.hand_number}</span>
                  {biggestPot > 0 && <span>Maior pote: {biggestPot.toLocaleString("pt-PT")}</span>}
                </div>
                <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                  {[...players]
                    .sort((a, b) => b.chips - (initialChips[b.id] ?? b.chips) - (a.chips - (initialChips[a.id] ?? a.chips)))
                    .map((p) => {
                      const net = p.chips - (initialChips[p.id] ?? p.chips);
                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-white/70 truncate max-w-[110px]">
                            {p.name} {p.id === you?.id && "(tu)"}
                          </span>
                          <span
                            className={`font-mono tabular-nums ${
                              net > 0 ? "text-emerald-400" : net < 0 ? "text-rose-400" : "text-white/40"
                            }`}
                          >
                            {net > 0 ? "+" : ""}
                            {net.toLocaleString("pt-PT")}
                          </span>
                        </div>
                      );
                    })}
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
          connectedIds={connectedIds}
          noteDots={Object.fromEntries(
            Object.entries(notes)
              .filter(([, n]) => n.tag !== "none")
              .map(([id, n]) => [id, TAG_META[n.tag].dot])
          )}
          noteTitles={Object.fromEntries(
            Object.entries(notes)
              .filter(([, n]) => n.text.trim())
              .map(([id, n]) => [id, n.text])
          )}
          onNoteClick={setEditingNoteFor}
          emotes={emotes}
          onSendEmote={handleSendEmote}
          isHost={isHost}
          onKick={handleKick}
        />

        {room.status === "waiting" && (
          <div className="mt-6 flex flex-col items-center gap-2 text-center">
            <div className="text-white/60 text-sm">
              {players.length} jogador{players.length === 1 ? "" : "es"} na sala — partilha o código{" "}
              <span className="font-mono text-amber-300">{code}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {you && room.allow_straddle && (
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
              {isHost && (
                <label className="flex items-center gap-1.5 text-white/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={room.rabbit_hunt_enabled}
                    onChange={handleToggleRabbitHunt}
                    className="accent-amber-500 w-3.5 h-3.5"
                  />
                  Rabbit Hunt
                </label>
              )}
            </div>

            {isHost && players.length < room.max_players && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-white/40">Adicionar bot:</span>
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => handleAddBot(d)}
                    className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:border-amber-400/40 text-white/70 hover:text-amber-200 transition"
                  >
                    {d === "easy" ? "Fácil" : d === "medium" ? "Médio" : "Difícil"}
                  </button>
                ))}
              </div>
            )}
            {isHost && players.some((p) => p.is_bot) && (
              <div className="flex flex-col items-center gap-1 text-xs">
                {players
                  .filter((p) => p.is_bot)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-white/50">
                      <span>{p.name}</span>
                      <select
                        value={p.bot_difficulty || "medium"}
                        onChange={(e) => handleSetBotDifficulty(p.id, e.target.value)}
                        className="bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-white/70"
                      >
                        <option value="easy">Fácil</option>
                        <option value="medium">Médio</option>
                        <option value="hard">Difícil</option>
                      </select>
                    </div>
                  ))}
              </div>
            )}

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

      {(() => {
        const actor = players.find((p) => p.seat === room.current_turn_seat);
        const actorDisconnected =
          actor && actor.id !== session.playerId && connectedIds.size > 0 && !connectedIds.has(actor.id);
        if (!actorDisconnected || room.phase === "showdown") return null;
        return (
          <div className="fixed top-14 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
            <div className="bg-slate-800/90 border border-slate-500/30 text-slate-200 text-xs rounded-full px-3 py-1.5 backdrop-blur">
              {actor!.name} está desligado — a jogada passa automaticamente quando o tempo acabar
            </div>
          </div>
        );
      })()}

      <AnimatePresence>
        {room.phase === "showdown" && revealing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              className="flex items-center gap-2.5 bg-black/70 border border-amber-400/25 rounded-full px-5 py-2.5 backdrop-blur"
            >
              <span className="text-amber-200/90 text-sm font-serif italic tracking-wide">A revelar</span>
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-amber-300"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                  />
                ))}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {yourTurn && you && room.phase !== "showdown" && room.status !== "paused" && (
        <ActionBar room={room} you={you} onAction={handleAction} busy={busy} />
      )}

      {room.status === "paused" && (
        <div className="fixed top-14 inset-x-0 z-20 flex justify-center px-4">
          {isHost ? (
            <button
              onClick={handleTogglePause}
              className="bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-semibold rounded-full px-4 py-1.5 backdrop-blur transition"
            >
              ⏸ Mesa em pausa — clica para retomar
            </button>
          ) : (
            <div className="bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-semibold rounded-full px-4 py-1.5 backdrop-blur pointer-events-none">
              ⏸ Mesa em pausa pelo anfitrião
            </div>
          )}
        </div>
      )}

      {!yourTurn && you && you.status === "active" && room.status === "playing" && room.phase !== "showdown" && (
        <div className="fixed bottom-4 inset-x-0 z-20 flex justify-center px-4">
          <div className="flex gap-2 bg-black/70 backdrop-blur border border-white/10 rounded-full px-2 py-2">
            <button
              onClick={() => setPreAction((p) => (p === "fold" ? null : "fold"))}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                preAction === "fold" ? "bg-rose-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {preAction === "fold" ? (
                <span className="inline-flex items-center gap-1">
                  <IconCheck size={12} /> Vou desistir
                </span>
              ) : (
                "Desistir (pré-ação)"
              )}
            </button>
            <button
              onClick={() => setPreAction((p) => (p === "check_call" ? null : "check_call"))}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                preAction === "check_call" ? "bg-sky-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {preAction === "check_call" ? (
                <span className="inline-flex items-center gap-1">
                  <IconCheck size={12} /> Vou pagar/passar
                </span>
              ) : (
                "Passar/Pagar (pré-ação)"
              )}
            </button>
          </div>
        </div>
      )}

      {settings.handStrength && room.status === "playing" && holeCards.length > 0 && room.phase !== "showdown" && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-2 z-20 pointer-events-none">
          {(() => {
            const label = handStrengthLabel(holeCards, room.community_cards, room.game_type);
            return label ? (
              <div className="text-[11px] font-serif text-[var(--gold)]/90 bg-black/60 backdrop-blur rounded-full px-3 py-1 border border-[var(--gold)]/20">
                {label}
              </div>
            ) : null;
          })()}
        </div>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Glossary open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />

      {editingNoteFor &&
        (() => {
          const target = players.find((p) => p.id === editingNoteFor);
          if (!target) return null;
          const note = notes[editingNoteFor] || { tag: "none" as const, text: "" };
          return (
            <PlayerNoteEditor
              playerName={target.name}
              note={note}
              onChange={(n) => handleNoteChange(editingNoteFor, n)}
              onClose={() => setEditingNoteFor(null)}
            />
          );
        })()}
    </div>
  );
}
