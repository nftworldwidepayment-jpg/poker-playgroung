"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Short cinematic opening: logo reveal over a dark field with drifting particles.
// Shows once per browser session, is skippable by tap/key, and never exceeds ~2s.
export function Splash() {
  const [show, setShow] = useState(false);
  const [particles, setParticles] = useState<{ x: number; y: number; d: number; delay: number }[]>([]);

  useEffect(() => {
    if (sessionStorage.getItem("poker-splash-seen")) return;
    sessionStorage.setItem("poker-splash-seen", "1");
    setShow(true);
    setParticles(
      Array.from({ length: 26 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        d: 2 + Math.random() * 2.5,
        delay: Math.random() * 0.8,
      }))
    );
    const t = setTimeout(() => setShow(false), 2000);
    const skip = () => setShow(false);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          style={{ background: "radial-gradient(ellipse at center, #0d141a 0%, #030507 70%)" }}
        >
          {particles.map((p, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: 3,
                height: 3,
                background: "rgba(201,169,97,0.5)",
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0.8, 0], scale: [0, 1, 0.4], y: [-8, -28] }}
              transition={{ duration: p.d, delay: p.delay, ease: "easeOut" }}
            />
          ))}

          <div className="text-center relative">
            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotateY: -40 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.1 }}
              className="text-6xl mb-2"
              style={{ filter: "drop-shadow(0 0 18px rgba(201,169,97,0.5))" }}
            >
              ♠
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 14, letterSpacing: "0.4em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0.02em" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
              className="font-serif text-4xl sm:text-5xl font-black text-[var(--gold-bright)]"
            >
              Poker Night
            </motion.h1>
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="h-px w-40 mx-auto mt-3 bg-gradient-to-r from-transparent via-[var(--gold)]/60 to-transparent"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
