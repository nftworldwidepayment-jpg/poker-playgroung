"use client";
import { motion } from "framer-motion";
import { NoteTag, PlayerNote, TAG_META } from "@/lib/notes";

const TAGS: NoteTag[] = ["none", "aggressive", "passive", "bluffer", "tight"];

export function PlayerNoteEditor({
  playerName,
  note,
  onChange,
  onClose,
}: {
  playerName: string;
  note: PlayerNote;
  onChange: (note: PlayerNote) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xs bg-slate-900/95 border border-amber-400/20 rounded-2xl p-4 shadow-2xl"
      >
        <div className="text-[10px] uppercase tracking-widest text-amber-300/60 font-semibold mb-1">
          Nota privada · só tu vês
        </div>
        <div className="text-lg font-bold text-white mb-3">{playerName}</div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...note, tag: t })}
              className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border transition ${
                note.tag === t
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                  : "border-white/10 text-white/50 hover:border-white/25"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${TAG_META[t].dot}`} />
              {TAG_META[t].label}
            </button>
          ))}
        </div>

        <textarea
          value={note.text}
          onChange={(e) => onChange({ ...note, text: e.target.value.slice(0, 200) })}
          placeholder="Ex: sobe muito pré-flop, paga tudo no river..."
          rows={3}
          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400/50 resize-none"
        />

        <button
          onClick={onClose}
          className="mt-3 w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition"
        >
          Guardar
        </button>
      </motion.div>
    </div>
  );
}
