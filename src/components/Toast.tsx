"use client";
import { AnimatePresence, motion } from "framer-motion";
import { IconAlertTriangle, IconInfo } from "./icons";

export interface ToastItem {
  id: number;
  message: string;
  tone?: "error" | "info";
}

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium shadow-xl backdrop-blur ${
              t.tone === "error"
                ? "bg-rose-950/90 border-rose-500/40 text-rose-200"
                : "bg-slate-900/90 border-amber-400/30 text-amber-100"
            }`}
          >
            {t.tone === "error" ? (
              <IconAlertTriangle size={15} className="shrink-0" />
            ) : (
              <IconInfo size={15} className="shrink-0" />
            )}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
