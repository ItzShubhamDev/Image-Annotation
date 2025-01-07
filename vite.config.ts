import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        exclude: ["lucide-react"],
    },
    build: {
        outDir: "static",
    },
    server: {
        proxy: {
            "/sam": {
                target: "http://localhost:5000",
                changeOrigin: true,
            },
        },
    },
});
