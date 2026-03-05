import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // 让前端以同源方式请求 /teams，避免浏览器 CORS 拦截
      "/teams": {
        target: "http://localhost:7777",
        changeOrigin: true,
      },
      // 轻量事件服务（step 状态）
      "/ops-events": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
