import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setupTests.js",
    },
    server: {
      proxy: {
        // 让前端以同源方式请求 /teams，避免浏览器 CORS 拦截
        "/teams": {
          target: env.VITE_OPS_ASSISTANT_PROXY_TARGET || "http://localhost:7777",
          changeOrigin: true,
        },
        // 轻量事件服务（step 状态）
        "/ops-events": {
          target: env.VITE_OPS_EVENTS_PROXY_TARGET || "http://localhost:8787",
          changeOrigin: true,
        },
        // 数字人 ASR/TTS 服务
        "/api/v1": {
          target: env.VITE_DIGITAL_HUMAN_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
        },
        "/health": {
          target: env.VITE_DIGITAL_HUMAN_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
