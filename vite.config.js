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
        // 时序轴 Step Status API
        "/api/step-status": {
          target: env.VITE_STEP_STATUS_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
        },
        // 告警收敛系统只读态势接口
        "/api/public": {
          target: env.VITE_ALERT_CONVERGER_PROXY_TARGET || "http://localhost:9541",
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
