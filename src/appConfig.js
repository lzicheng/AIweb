const env = import.meta.env || {};

const readString = (key, fallback) => {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
};

const readNumber = (key, fallback) => {
  const value = Number(env[key]);
  return Number.isFinite(value) ? value : fallback;
};

export const APP_CONFIG = {
  opsAssistantApiUrl: readString("VITE_OPS_ASSISTANT_API_URL", "/teams/ops_team/runs"),
  opsEventsStepStatesUrl: readString("VITE_OPS_EVENTS_STEP_STATES_URL", "/ops-events/step-states"),
  alertSituation: {
    dashboardUrl: readString("VITE_ALERT_DASHBOARD_API_URL", "/api/public/dashboard"),
    alertsUrl: readString("VITE_ALERT_ALERTS_API_URL", "/api/public/alerts"),
  },
  digitalHuman: {
    asrApiUrl: readString("VITE_DIGITAL_HUMAN_ASR_API_URL", "/api/v1/asr"),
    healthUrl: readString("VITE_DIGITAL_HUMAN_HEALTH_URL", "/health"),
    language: readString("VITE_DIGITAL_HUMAN_LANGUAGE", "zh"),
    modelUrl: readString("VITE_DIGITAL_HUMAN_MODEL_URL", "/sdk/Samples/Resources/Haru/Haru.model3.json"),
    ttsApiUrl: readString("VITE_DIGITAL_HUMAN_TTS_API_URL", "/api/v1/tts"),
    ttsSpeed: readNumber("VITE_DIGITAL_HUMAN_TTS_SPEED", 1),
  },
};
