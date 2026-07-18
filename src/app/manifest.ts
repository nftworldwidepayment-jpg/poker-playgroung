import type { MetadataRoute } from "next";

// Makes the app installable to a home screen (Android "Add to Home Screen",
// iOS Safari "Add to Home Screen") — no service worker/offline caching here,
// deliberately kept simple to avoid stale-cache bugs on a realtime app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poker Night",
    short_name: "Poker Night",
    description: "Texas Hold'em & PLO4 em tempo real, com os teus amigos.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e12",
    theme_color: "#0a0e12",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
