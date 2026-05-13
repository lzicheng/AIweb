import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

const RECORDER_FLUSH_DELAY_MS = 120;

function getRecorderErrorMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "麦克风权限被拒绝，请在浏览器地址栏或系统隐私设置中允许麦克风访问。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "未找到可用麦克风设备，请检查输入设备连接。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "麦克风暂不可用，可能被其他程序占用。";
  }
  if (name === "SecurityError") {
    return "当前页面不允许访问麦克风，请使用 localhost/HTTPS，并检查浏览器权限策略。";
  }
  if (name === "AbortError") {
    return "浏览器中断了麦克风采集，请重试。";
  }
  return error instanceof Error ? error.message : "无法启动录音。";
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return CANDIDATE_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported?.(mimeType)) || "";
}

export function useAudioRecorder(options = {}) {
  const {
    maxRecordingDurationMs = 10000,
    onSilence,
    silenceDurationMs = 1400,
    silenceThreshold = 0.012,
  } = options;
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const stopPromiseRef = useRef(null);
  const startedAtRef = useRef(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const monitorFrameRef = useRef(0);
  const silenceStartedAtRef = useRef(0);
  const hasSpokenRef = useRef(false);
  const autoStopTriggeredRef = useRef(false);
  const onSilenceRef = useRef(onSilence);
  const maxDurationTimerRef = useRef(0);

  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState("");
  const [recorderStatus, setRecorderStatus] = useState("待命");

  useEffect(() => {
    onSilenceRef.current = onSilence;
  }, [onSilence]);

  const isSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined",
    [],
  );

  const releaseStream = useCallback(() => {
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const teardownMonitor = useCallback(async () => {
    if (maxDurationTimerRef.current) {
      window.clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = 0;
    }

    if (monitorFrameRef.current) {
      window.cancelAnimationFrame(monitorFrameRef.current);
      monitorFrameRef.current = 0;
    }

    try {
      sourceNodeRef.current?.disconnect?.();
    } catch {
      // 忽略重复释放的节点异常
    }

    try {
      analyserRef.current?.disconnect?.();
    } catch {
      // 忽略重复释放的节点异常
    }

    sourceNodeRef.current = null;
    analyserRef.current = null;
    silenceStartedAtRef.current = 0;
    hasSpokenRef.current = false;
    autoStopTriggeredRef.current = false;

    try {
      await audioContextRef.current?.close?.();
    } catch {
      // 某些浏览器重复 close 会抛错，这里直接吞掉即可。
    }
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    if (!isRecording) return undefined;
    const timer = window.setInterval(() => {
      setDurationMs(Date.now() - startedAtRef.current);
    }, 200);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => () => {
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop?.();
      }
    } catch {
      // 忽略卸载阶段的 stop 异常
    }
    teardownMonitor();
    releaseStream();
  }, [releaseStream, teardownMonitor]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("当前浏览器不支持音频采集。");
      setRecorderStatus("浏览器不支持 getUserMedia 或 MediaRecorder");
      throw new Error("当前浏览器不支持音频采集。");
    }

    if (isRecording) return;
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      const message = "当前页面不是安全上下文，请使用 http://localhost 或 HTTPS 访问后再启用麦克风。";
      setError(message);
      setRecorderStatus("非安全上下文，无法请求麦克风");
      throw new Error(message);
    }

    setError("");
    setRecorderStatus("正在请求麦克风权限");
    setDurationMs(0);
    recordedChunksRef.current = [];
    silenceStartedAtRef.current = 0;
    hasSpokenRef.current = false;
    autoStopTriggeredRef.current = false;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (requestError) {
      const message = getRecorderErrorMessage(requestError);
      setError(message);
      setRecorderStatus(message);
      throw new Error(message);
    }

    mediaStreamRef.current = stream;

    const audioTracks = stream.getAudioTracks();
    const activeAudioTrack = audioTracks.find((track) => track.readyState === "live") || audioTracks[0];
    if (!activeAudioTrack) {
      releaseStream();
      const message = "浏览器未返回有效音频轨道，请检查麦克风设备。";
      setError(message);
      setRecorderStatus(message);
      throw new Error(message);
    }

    const trackLabel = activeAudioTrack.label || "默认麦克风";
    setRecorderStatus(`已获取麦克风：${trackLabel}`);

    const mimeType = getSupportedMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    mediaRecorderRef.current = recorder;
    startedAtRef.current = Date.now();

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioContextCtor) {
      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      const sourceNode = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      sourceNode.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceNodeRef.current = sourceNode;

      const sampleBuffer = new Uint8Array(analyser.frequencyBinCount);
      const monitorVolume = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
          monitorFrameRef.current = 0;
          return;
        }

        analyser.getByteTimeDomainData(sampleBuffer);
        let sumSquares = 0;
        for (let index = 0; index < sampleBuffer.length; index += 1) {
          const normalized = (sampleBuffer[index] - 128) / 128;
          sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / sampleBuffer.length);
        const now = Date.now();

        if (rms >= silenceThreshold) {
          hasSpokenRef.current = true;
          silenceStartedAtRef.current = 0;
        } else if (hasSpokenRef.current) {
          if (!silenceStartedAtRef.current) {
            silenceStartedAtRef.current = now;
          }

          if (
            !autoStopTriggeredRef.current &&
            now - silenceStartedAtRef.current >= silenceDurationMs
          ) {
            autoStopTriggeredRef.current = true;
            void onSilenceRef.current?.();
            monitorFrameRef.current = 0;
            return;
          }
        }

        monitorFrameRef.current = window.requestAnimationFrame(monitorVolume);
      };

      monitorFrameRef.current = window.requestAnimationFrame(monitorVolume);
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
        setRecorderStatus(`已收到音频块：${recordedChunksRef.current.length} 个，最近 ${event.data.size} bytes`);
      }
    };

    recorder.onerror = (event) => {
      const message = getRecorderErrorMessage(event.error);
      setError(message || "录音过程中发生错误，请重试。");
      setRecorderStatus(message || "录音过程中发生错误");
    };

    recorder.onstop = async () => {
      const blobType = mimeType || recordedChunksRef.current[0]?.type || "audio/webm";
      const blob =
        recordedChunksRef.current.length > 0
          ? new Blob(recordedChunksRef.current, { type: blobType })
          : null;
      const stopPromise = stopPromiseRef.current;

      if (blob && blob.size > 0) {
        setRecorderStatus(`录音完成：${blob.size} bytes，${blob.type || blobType}`);
        stopPromise?.resolve?.(blob);
      } else {
        const message = "未采集到有效音频，请确认麦克风权限和输入设备后重试。";
        setRecorderStatus(message);
        stopPromise?.reject?.(new Error(message));
      }
      stopPromiseRef.current = null;

      recordedChunksRef.current = [];
      setIsRecording(false);
      setDurationMs(0);
      await teardownMonitor();
      releaseStream();
    };

    recorder.start(250);
    setIsRecording(true);
    setRecorderStatus(`录音中：${trackLabel}，格式 ${recorder.mimeType || mimeType || "浏览器默认"}`);

    if (maxRecordingDurationMs > 0) {
      maxDurationTimerRef.current = window.setTimeout(() => {
        if (!autoStopTriggeredRef.current && mediaRecorderRef.current?.state === "recording") {
          autoStopTriggeredRef.current = true;
          void onSilenceRef.current?.();
        }
      }, maxRecordingDurationMs);
    }
  }, [
    isRecording,
    isSupported,
    maxRecordingDurationMs,
    releaseStream,
    silenceDurationMs,
    silenceThreshold,
    teardownMonitor,
  ]);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return null;
    }

    if (stopPromiseRef.current?.promise) {
      return stopPromiseRef.current.promise;
    }

    autoStopTriggeredRef.current = true;

    const promise = new Promise((resolve, reject) => {
      stopPromiseRef.current = { promise: null, resolve, reject };

      const stopSafely = () => {
        try {
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        } catch (stopError) {
          stopPromiseRef.current = null;
          reject(stopError);
        }
      };

      try {
        if (recorder.state === "recording" && typeof recorder.requestData === "function") {
          recorder.requestData();
          window.setTimeout(stopSafely, RECORDER_FLUSH_DELAY_MS);
        } else {
          stopSafely();
        }
      } catch {
        stopSafely();
      }
    });

    stopPromiseRef.current.promise = promise;
    return promise;
  }, []);

  return {
    durationMs,
    error,
    isRecording,
    isSupported,
    recorderStatus,
    startRecording,
    stopRecording,
  };
}
