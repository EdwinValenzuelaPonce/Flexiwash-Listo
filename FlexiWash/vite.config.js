import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo (npm run dev) las llamadas /api y /uploads se envían al servidor de demo (npm start).
const api = { target: "http://localhost:3001", changeOrigin: true };
export default defineConfig({
  plugins: [react()],
  server: { host: true, proxy: { "/api": api, "/uploads": api } },
});
