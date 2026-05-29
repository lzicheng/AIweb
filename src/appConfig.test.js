import { afterEach, describe, expect, test, vi } from "vitest";

const loadAppConfig = async (runtimeConfig) => {
  vi.resetModules();

  if (runtimeConfig) {
    window.__APP_CONFIG__ = runtimeConfig;
  } else {
    delete window.__APP_CONFIG__;
  }

  const { APP_CONFIG } = await import("./appConfig");
  return APP_CONFIG;
};

describe("appConfig", () => {
  afterEach(() => {
    delete window.__APP_CONFIG__;
    vi.resetModules();
  });

  test("运行时配置优先于构建期配置和默认值", async () => {
    const config = await loadAppConfig({
      VITE_ALERT_ALERTS_API_URL: "/runtime/alerts",
      VITE_ALERT_DASHBOARD_API_URL: "/runtime/dashboard",
      VITE_DIGITAL_HUMAN_ASR_API_URL: "/runtime/asr",
      VITE_DIGITAL_HUMAN_HEALTH_URL: "/runtime/health",
      VITE_DIGITAL_HUMAN_LANGUAGE: "en",
      VITE_DIGITAL_HUMAN_MODEL_URL: "/runtime/model.json",
      VITE_DIGITAL_HUMAN_TTS_API_URL: "/runtime/tts",
      VITE_DIGITAL_HUMAN_TTS_SPEED: "1.25",
      VITE_OPS_ASSISTANT_API_URL: "/runtime/ops",
      VITE_STEP_STATUS_API_URL: "/runtime/steps",
    });

    expect(config).toEqual({
      alertSituation: {
        alertsUrl: "/runtime/alerts",
        dashboardUrl: "/runtime/dashboard",
      },
      digitalHuman: {
        asrApiUrl: "/runtime/asr",
        healthUrl: "/runtime/health",
        language: "en",
        modelUrl: "/runtime/model.json",
        ttsApiUrl: "/runtime/tts",
        ttsSpeed: 1.25,
      },
      opsAssistantApiUrl: "/runtime/ops",
      stepStatusApiUrl: "/runtime/steps",
    });
  });

  test("运行时数字配置无效时回退到默认值", async () => {
    const config = await loadAppConfig({
      VITE_DIGITAL_HUMAN_TTS_SPEED: "not-a-number",
    });

    expect(config.digitalHuman.ttsSpeed).toBe(1);
  });
});
