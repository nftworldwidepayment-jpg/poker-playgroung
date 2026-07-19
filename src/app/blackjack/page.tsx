"use client";
import { useRouter } from "next/navigation";
import { Blackjack } from "@/components/Blackjack";

export default function BlackjackPage() {
  const router = useRouter();
  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(16,185,129,0.12), transparent), #04070a",
        }}
      />
      <div className="flex items-center justify-between px-4 py-4">
        <button
          onClick={() => router.push("/")}
          className="text-white/50 hover:text-white text-sm shrink-0 py-1.5 px-1"
        >
          ← Sair
        </button>
        <span className="text-[10px] uppercase tracking-widest text-amber-300/60 font-serif border border-amber-400/20 rounded-full px-3 py-1">
          Blackjack
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center px-3 pb-8">
        <Blackjack />
      </div>
    </div>
  );
}
