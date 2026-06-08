import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function readString(env, key) {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeHost(value) {
  return value.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
}

function buildAlertConvergerTarget(env) {
  const host = normalizeHost(readString(env, "VITE_ALERT_CONVERGER_HOST"));
  const port = readString(env, "VITE_ALERT_CONVERGER_PORT");
  if (host || port) {
    return `http://${host || "localhost"}${port ? `:${port}` : ""}`;
  }

  return readString(env, "VITE_ALERT_CONVERGER_PROXY_TARGET") || "http://localhost:9541";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const alertConvergerTarget = buildAlertConvergerTarget(env);

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
          target: alertConvergerTarget,
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
