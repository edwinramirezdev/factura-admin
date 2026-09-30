import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El portal de administrador corre aparte del sistema de clientes (5173)
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
});
