import { APP_CONFIG } from "./appConfig";

const { asrApiUrl, language, ttsApiUrl, ttsSpeed } = APP_CONFIG.digitalHuman;

const pickString = (...values) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0);

const getAudioFileName = (audioBlob) => {
  const type = typeof audioBlob?.type === "string" ? audioBlob.type : "";
  if (type.includes("mp4")) return "digital-human-input.mp4";
  if (type.includes("ogg")) return "digital-human-input.ogg";
  if (type.includes("wav")) return "digital-human-input.wav";
  return "digital-human-input.webm";
};

async function safeParseJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return response.json();
}

async function readErrorDetail(response) {
  const data = await safeParseJson(response);
  const jsonMessage = pickString(data?.detail, data?.error, data?.message);
  if (jsonMessage) return jsonMessage;

  try {
    const text = await response.text();
    return text.trim();
  } catch {
    return "";
  }
}

export async function recognizeSpeech({ audioBlob, signal }) {
  if (!audioBlob) {
    throw new Error("未获取到录音数据。");
  }
  if (audioBlob.size <= 0) {
    throw new Error("录音文件为空，请确认麦克风权限和输入设备后重试。");
  }

  const formData = new FormData();
  formData.append("audio", audioBlob, getAudioFileName(audioBlob));
  if (language) {
    formData.append("language", language);
  }

  const response = await fetch(asrApiUrl, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`ASR 服务异常：${response.status}${detail ? `，${detail}` : ""}`);
  }

  const data = await safeParseJson(response);
  const transcript = pickString(data?.text, data?.content, data?.transcript, data?.result);

  if (!transcript) {
    throw new Error("ASR 服务未返回可用文本。");
  }

  return {
    confidence: typeof data?.confidence === "number" ? data.confidence : null,
    language: pickString(data?.language) || language,
    source: "remote",
    text: transcript,
  };
}

export async function synthesizeSpeech({ text, signal }) {
  if (!text.trim()) {
    return {
      source: "empty",
      audioUrl: "",
      mimeType: "",
    };
  }

  const response = await fetch(ttsApiUrl, {
    method: "POST",
    headers: {
      accept: "audio/wav,audio/*,application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      language,
      speed: ttsSpeed,
      text,
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`TTS 服务异常：${response.status}${detail ? `，${detail}` : ""}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.startsWith("audio/")) {
    const audioBlob = await response.blob();
    return {
      source: "remote",
      audioUrl: URL.createObjectURL(audioBlob),
      mimeType: audioBlob.type || contentType,
    };
  }

  const data = await safeParseJson(response);
  const audioUrl = pickString(data?.audioUrl, data?.url);

  if (!audioUrl) {
    throw new Error("TTS 服务未返回音频地址。");
  }

  return {
    source: "remote",
    audioUrl,
    mimeType: pickString(data?.mimeType, data?.contentType) || "audio/wav",
  };
}
