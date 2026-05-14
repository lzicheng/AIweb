import { beforeEach, describe, expect, test, vi } from "vitest";
import { recognizeSpeech } from "./digitalHumanSpeech";

describe("digitalHumanSpeech", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  test("空录音不会上传到 ASR 服务", async () => {
    await expect(
      recognizeSpeech({
        audioBlob: new Blob([], { type: "audio/webm" }),
      }),
    ).rejects.toThrow("录音文件为空");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("ASR 请求会提交音频文件和语言参数", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ confidence: -0.16, language: "zh", text: "你好" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    const result = await recognizeSpeech({
      audioBlob: new Blob(["voice"], { type: "audio/webm" }),
    });

    expect(result).toEqual({
      confidence: -0.16,
      language: "zh",
      source: "remote",
      text: "你好",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/asr");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get("language")).toBe("zh");
    expect(init.body.get("audio").size).toBeGreaterThan(0);
  });
});
