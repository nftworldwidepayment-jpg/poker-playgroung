"use client";
import { useEffect } from "react";
import { useSettings } from "@/lib/settings";

const PRELOAD_IMAGES = [
  "/images/table-bg.webp",
  "/images/card-back.webp",
  "/images/chip-black.webp",
  "/images/chip-red.webp",
  "/images/chip-green.webp",
  "/images/chip-purple.webp",
];

// Applies global, non-visual-tree preferences (font scale, high contrast) as
// attributes on <html> so plain CSS can react everywhere at once, and warms
// the image cache for assets almost every screen needs, so nothing "pops in"
// the first time a table or chip renders.
export function PreferenceEffects() {
  const [settings] = useSettings();

  useEffect(() => {
    document.documentElement.setAttribute("data-font-size", settings.fontSize);
    document.documentElement.setAttribute("data-contrast", settings.highContrast ? "high" : "normal");
  }, [settings.fontSize, settings.highContrast]);

  useEffect(() => {
    PRELOAD_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  return null;
}
