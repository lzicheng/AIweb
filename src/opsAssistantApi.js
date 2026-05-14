import { APP_CONFIG } from "./appConfig";

const OPS_ASSISTANT_API_URL = APP_CONFIG.opsAssistantApiUrl;

export const createSessionId = () => String(Math.floor(10000000 + Math.random() * 90000000));

const pickString = (...values) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0);

export const extractAssistantText = (data) => {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return "接口未返回有效内容。";

  const direct = pickString(data.content, data.reply, data.text);
  if (direct) return direct;

  const nested = pickString(
    data?.data?.content,
    data?.result?.content,
    data?.output?.content,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.delta?.content,
    typeof data?.message === "object" ? data?.message?.content : undefined,
  );
  if (nested) return nested;

  const detail = pickString(data.detail, data.error, data.error_message, data.message);
  if (detail) return detail;

  return JSON.stringify(data, null, 2);
};

export async function runOpsAssistant({ message, sessionId, signal }) {
  const form = new FormData();
  form.append("message", message);
  form.append("stream", "false");
  form.append("monitor", "");
  form.append("session_id", sessionId);
  form.append("user_id", "");
  form.append("version", "");
  form.append("background", "");

  const response = await fetch(OPS_ASSISTANT_API_URL, {
    method: "POST",
    headers: { accept: "application/json" },
    body: form,
    signal,
  });

  if (!response.ok) {
    throw new Error(`接口异常：${response.status}`);
  }

  const data = await response.json();
  return extractAssistantText(data);
}
