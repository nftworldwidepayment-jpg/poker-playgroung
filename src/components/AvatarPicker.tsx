"use client";
import { AVATAR_OPTIONS } from "@/lib/avatars";

export function AvatarPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <label className="text-[11px] text-white/40 mb-1.5 block">Avatar (opcional)</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-white/40 text-xs font-bold shrink-0 transition ${
            value === null ? "border-[var(--gold)]" : "border-white/10 hover:border-white/25"
          } bg-black/30`}
          title="Sem avatar"
        >
          —
        </button>
        {AVATAR_OPTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            title={a.label}
            className={`w-11 h-11 rounded-full overflow-hidden border-2 shrink-0 transition ${
              value === a.id ? "border-[var(--gold)] shadow-[0_0_10px_rgba(201,169,97,0.5)]" : "border-white/10 hover:border-white/25"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.src} alt={a.label} className="w-full h-full object-cover" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}
