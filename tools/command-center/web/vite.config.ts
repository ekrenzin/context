import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    outDir: path.resolve(__dirname, "..", "dist", "web"),
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/, /ctx-mqtt/],
    },
  },
  optimizeDeps: {
    include: ["ctx-mqtt", "ctx-mqtt/topics"],
  },
  server: {
    port: 19471,
    proxy: {
      "/api": "http://127.0.0.1:19470",
      "/ws": { target: "ws://127.0.0.1:19470", ws: true },
    },
  },
});
