import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],

      manifest: {
        name: "Engage — Lead & Location Ledger",
        short_name: "Engage",
        description:
          "Employee lead capture and live location tracking, with GPS verification built in.",
        theme_color: "#1A1D23",
        background_color: "#F4F5F7",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
      },

      devOptions: {
        enabled: true,
      },
    }),
  ],
});
