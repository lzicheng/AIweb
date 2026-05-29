import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAudioRecorder } from "./useAudioRecorder";

const originalMediaDevices = navigator.mediaDevices;
const originalAudioContext = window.AudioContext;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;
let analyserSampleValue = 128;

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || "audio/webm";
    this.state = "inactive";
    this.ondataavailable = null;
    this.onerror = null;
    this.onstop = null;
  }

  start() {
    this.state = "recording";
  }

  requestData() {
    this.ondataavailable?.({
      data: new Blob(["voice"], { type: this.mimeType }),
    });
  }

  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
}

class SilentAudioContext {
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 8,
      smoothingTimeConstant: 0,
      disconnect: vi.fn(),
      getByteTimeDomainData: (buffer) => buffer.fill(analyserSampleValue),
    };
  }

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  close() {
    return Promise.resolve();
  }
}

describe("useAudioRecorder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    analyserSampleValue = 128;
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getAudioTracks: () => [{ label: "测试麦克风", readyState: "live", stop: vi.fn() }],
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: SilentAudioContext,
    });
    window.requestAnimationFrame = (callback) => window.setTimeout(callback, 16);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: originalAudioContext,
    });
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("从开始录音一直无声音时也会按静音时长自动停止", async () => {
    const onSilence = vi.fn();
    const { result } = renderHook(() =>
      useAudioRecorder({
        maxRecordingDurationMs: 0,
        onSilence,
        silenceDurationMs: 32,
      }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(80);
    });

    expect(onSilence).toHaveBeenCalledTimes(1);
  });

  test("真实麦克风底噪略高于纯静音时也会自动停止", async () => {
    analyserSampleValue = 131;
    const onSilence = vi.fn();
    const { result } = renderHook(() =>
      useAudioRecorder({
        maxRecordingDurationMs: 0,
        onSilence,
        silenceDurationMs: 32,
      }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(80);
    });

    expect(onSilence).toHaveBeenCalledTimes(1);
  });
});
