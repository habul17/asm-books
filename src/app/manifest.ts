import type { MetadataRoute } from "next";

/** Lets the app be added to a phone's home screen and open full screen, like an installed app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ASM Autoparts",
    short_name: "ASM",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
