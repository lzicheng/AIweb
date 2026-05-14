import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  BarChart3,
  Keyboard,
  MessagesSquare,
  Mic,
  SendHorizontal,
  Sparkles,
  Square,
} from "lucide-react";
import { createSessionId, runOpsAssistant } from "./opsAssistantApi";
import { APP_CONFIG } from "./appConfig";
import { useAudioRecorder } from "./useAudioRecorder";
import { recognizeSpeech } from "./digitalHumanSpeech";
import { createLive2DRenderer } from "./live2dRenderer";
import { createContentPlaybackService } from "./contentPlaybackService";
import { useTaskSchedule } from "./useTaskSchedule";

function createTimestamp() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildLogEntry(role, content, source = "") {
  return {
    role,
    content,
    source,
    createdAt: createTimestamp(),
  };
}

function createInitialLogs() {
  return [
    buildLogEntry(
      "assistant",
      "你好，我是数字人助手。你可以直接语音提问，也可以在右侧输入文字，我会调用运营助手接口回复并同步播报。",
      "system",
    ),
  ];
}

function formatDuration(durationMs) {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${restSeconds.toString().padStart(2, "0")}`;
}

export default function DigitalHumanTab() {
  const [statusText, setStatusText] = useState("待命");
  const [sessionId, setSessionId] = useState(() => createSessionId());
  const [conversationLogs, setConversationLogs] = useState(() => createInitialLogs());
  const [inputText, setInputText] = useState("");
  const [activeInputMode, setActiveInputMode] = useState("voice");
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [taskAnnounceEnabled, setTaskAnnounceEnabled] = useState(true);

  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const scrollRef = useRef(null);
  const rendererRef = useRef(null);
  const playerRef = useRef(null);
  const flowAbortRef = useRef(null);
  const activeSessionRef = useRef(sessionId);
  const mountedRef = useRef(true);
  const autoStopHandlerRef = useRef(() => {});
  const busyRef = useRef(false);
  const isRecordingRef = useRef(false);

  const {
    durationMs,
    error: recorderError,
    isRecording,
    isSupported,
    recorderStatus,
    startRecording,
    stopRecording,
  } = useAudioRecorder({
    onSilence: () => autoStopHandlerRef.current?.(),
  });

  busyRef.current = busy;
  isRecordingRef.current = isRecording;

  useEffect(() => {
    activeSessionRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;

    let disposed = false;
    (async () => {
      try {
        const renderer = await createLive2DRenderer({
          canvas: canvasRef.current,
          modelSettingsUrl: APP_CONFIG.digitalHuman.modelUrl,
        });
        if (disposed) {
          renderer.dispose();
          return;
        }

        rendererRef.current = renderer;
        playerRef.current = createContentPlaybackService({
          audioElement: audioRef.current,
          renderer,
          onQueueEmpty: () => {
            if (mountedRef.current && !busyRef.current && !isRecordingRef.current) {
              setStatusText("待命");
            }
          },
        });
      } catch (error) {
        setPanelError(error instanceof Error ? error.message : "数字人渲染层初始化失败。");
      }
    })();

    return () => {
      disposed = true;
      mountedRef.current = false;
      flowAbortRef.current?.abort?.();
      playerRef.current?.dispose?.();
      rendererRef.current?.dispose?.();
    };
  }, []);

  const {
    currentOccurrence,
    currentTask,
    isArrived,
    minutesToArrive,
    minutesToMove,
    nextTask,
  } = useTaskSchedule({
    playbackService: playerRef.current,
    announceEnabled: taskAnnounceEnabled,
    onTaskChange: ({ task, announcement }) => {
      if (mountedRef.current && announcement) {
        setStatusText(`播报任务：${task.title}`);
      }
    },
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [busy, conversationLogs, isRecording]);

  useEffect(() => {
    if (!isSupported) {
      setActiveInputMode("text");
    }
  }, [isSupported]);

  const quickActions = useMemo(
    () => [
      {
        key: "voice",
        icon: AudioLines,
        title: "语音对话",
        description: "开启语音采集并发起完整问答链路",
      },
      {
        key: "text",
        icon: Keyboard,
        title: "文本对话",
        description: "键入文字后直接调用运营助手问答",
      },
      {
        key: "ops",
        icon: MessagesSquare,
        title: "运营问答",
        description: "适合处理流程、运营与知识类提问",
      },
      {
        key: "broadcast",
        icon: BarChart3,
        title: "数据播报",
        description: "播报结果和说话动作保持同步输出",
      },
    ],
    [],
  );

  const appendLog = useCallback((role, content, source = "") => {
    setConversationLogs((current) => [...current, buildLogEntry(role, content, source)]);
  }, []);

  const playContent = useCallback(async (text) => {
    if (!text.trim()) return;
    if (!playerRef.current) throw new Error("数字人播放服务尚未初始化完成。");

    flowAbortRef.current?.abort?.();
    const controller = new AbortController();
    flowAbortRef.current = controller;

    setStatusText("数字人播报中");
    await playerRef.current.playContent({
      signal: controller.signal,
      text,
    });

    if (mountedRef.current) {
      setStatusText("待命");
    }
  }, []);

  const stopCurrentFlow = useCallback((nextStatus = "待命") => {
    flowAbortRef.current?.abort?.();
    playerRef.current?.stop?.();
    if (mountedRef.current) {
      setBusy(false);
      setStatusText(nextStatus);
    }
  }, []);

  const requestAssistantReply = useCallback(
    async ({ message, source }) => {
      const text = message.trim();
      if (!text) return;

      const sessionAtSend = sessionId;
      appendLog("user", text, source);

      flowAbortRef.current?.abort?.();
      const controller = new AbortController();
      flowAbortRef.current = controller;

      setStatusText(source === "voice" ? "语音识别完成，等待回复" : "等待运营助手回复");

      const assistantReply = await runOpsAssistant({
        message: text,
        sessionId: sessionAtSend,
        signal: controller.signal,
      });

      if (!mountedRef.current || sessionAtSend !== activeSessionRef.current) return;

      appendLog("assistant", assistantReply, "assistant");
      await playContent(assistantReply);
    },
    [appendLog, playContent, sessionId],
  );

  const handleStopRecordingAndTalk = useCallback(async () => {
    if (!isRecordingRef.current || busyRef.current) return;

    try {
      setBusy(true);
      setPanelError("");
      setStatusText("结束录音中");

      const audioBlob = await stopRecording();
      if (!audioBlob) {
        throw new Error("未采集到有效音频。");
      }

      flowAbortRef.current?.abort?.();
      const controller = new AbortController();
      flowAbortRef.current = controller;

      setStatusText("ASR 识别中");
      const asrResult = await recognizeSpeech({
        audioBlob,
        signal: controller.signal,
      });

      if (!mountedRef.current || activeSessionRef.current !== sessionId) return;

      await requestAssistantReply({
        message: asrResult.text,
        source: "voice",
      });
    } catch (error) {
      if (error?.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "数字人对话流程执行失败。";
      setPanelError(message);
      appendLog("assistant", `处理失败：${message}`, "assistant");
      setStatusText("待命");
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  }, [appendLog, requestAssistantReply, sessionId, stopRecording]);

  useEffect(() => {
    autoStopHandlerRef.current = handleStopRecordingAndTalk;
  }, [handleStopRecordingAndTalk]);

  const handleStartRecording = async () => {
    if (busyRef.current || isRecordingRef.current) return;

    try {
      setPanelError("");
      setStatusText("麦克风采集中");
      await startRecording();
    } catch (error) {
      setStatusText("待命");
      setPanelError(error instanceof Error ? error.message : "无法启动录音。");
    }
  };

  const handleSendTextMessage = async () => {
    const text = inputText.trim();
    if (!text || busy || isRecording) return;

    try {
      setBusy(true);
      setPanelError("");
      setInputText("");
      await requestAssistantReply({
        message: text,
        source: "typed",
      });
    } catch (error) {
      if (error?.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "发送消息失败。";
      setPanelError(message);
      appendLog("assistant", `处理失败：${message}`, "assistant");
      setStatusText("待命");
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  };

  const handleResetSession = async () => {
    if (isRecording) {
      try {
        await stopRecording();
      } catch {
        // 重置会话时优先释放录音资源，失败则继续重置界面。
      }
    }
    stopCurrentFlow();
    setInputText("");
    setPanelError("");
    setSessionId(createSessionId());
    setConversationLogs(createInitialLogs());
    setActiveInputMode(isSupported ? "voice" : "text");
  };

  const handleToggleTaskAnnounce = () => {
    setTaskAnnounceEnabled((prev) => !prev);
  };

  const showAssistantThinking = busy && !isRecording && statusText !== "数字人播报中";
  const statusLabel = isRecording ? `录音中 ${formatDuration(durationMs)}` : statusText;
  const activeError = recorderError || panelError;
  const voiceButtonLabel = isRecording ? "结束并发送" : "点击开始说话";
  const voiceSecondaryText = !isSupported
    ? "当前浏览器不支持 MediaRecorder，请切换到文字输入。"
    : activeError
      ? activeError
      : isRecording
        ? `已录制 ${formatDuration(durationMs)}，停止说话后会自动发送，也可以手动结束`
        : busy
          ? "正在处理当前会话，请稍候。"
          : recorderStatus && recorderStatus !== "待命"
            ? recorderStatus
            : "说完后自动发送";
  const isVoiceActionDisabled = !isSupported || busy;
  const voiceAction = isRecording ? handleStopRecordingAndTalk : handleStartRecording;
  const showStopAction = busy || statusText === "数字人播报中";
  const handleInputModeChange = (mode) => {
    if (mode === activeInputMode) return;
    if (mode === "voice" && (!isSupported || isRecording)) return;
    if (isRecording) return;
    setActiveInputMode(mode);
  };

  const taskInfoText = currentTask
    ? isArrived
      ? `当前任务：${currentTask.time} ${currentTask.title}`
      : `下一任务：${currentTask.time} ${currentTask.title}（约${Math.ceil(minutesToArrive)}分钟后）`
    : "";

  return (
    <section className="relative h-full overflow-hidden rounded-[30px] border border-white/55 bg-white/78 p-6 shadow-[0_28px_90px_rgba(30,41,59,0.10)] backdrop-blur-xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[34px] font-semibold tracking-tight text-slate-900">
              数字人对话台
            </h2>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
              <Sparkles size={14} />
              Live2D 数字人
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            与数字人实时对话，获取信息，完成任务，提升运营效率。
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 ${
              taskAnnounceEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={handleToggleTaskAnnounce}
          >
            <Sparkles size={16} />
            {taskAnnounceEnabled ? "任务播报开启" : "任务播报关闭"}
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            onClick={handleResetSession}
          >
            <Sparkles size={16} />
            重置会话
          </button>
        </div>
      </div>

      {taskInfoText ? (
        <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm text-indigo-700">
          {taskInfoText}
        </div>
      ) : null}

      <div className="grid h-[calc(100%-4.8rem)] min-h-0 items-stretch gap-5 lg:grid-cols-[minmax(0,1.14fr)_minmax(380px,0.86fr)]">
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="digital-human-stage relative min-h-[520px] flex-1 overflow-hidden rounded-[28px] border border-slate-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <canvas ref={canvasRef} className="h-full w-full" />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700/90">
                  Digital Human
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600">实时播报与问答</p>
              </div>

              <div className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
                {statusText}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="flex min-h-[124px] flex-col rounded-[22px] border border-slate-200/85 bg-white/90 px-4 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.10)] transition hover:-translate-y-0.5"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                    <Icon size={18} />
                  </div>
                  <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-full min-h-0 flex-1 flex-col rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-slate-800">对话记录</div>
              <div
                className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  busy || isRecording
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    busy || isRecording ? "bg-emerald-400" : "bg-slate-300"
                  }`}
                />
                {statusLabel}
              </div>
            </div>

            {activeError ? (
              <div className="mb-3 rounded-[16px] bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {activeError}
              </div>
            ) : null}

            <div
              ref={scrollRef}
              className="chat-scroll min-h-0 flex-1 space-y-3 rounded-[22px] bg-slate-50/70 px-3 py-3 overflow-y-auto"
            >
              {conversationLogs.map((item, index) => (
                <div
                  key={`${item.role}-${item.source || "default"}-${index}`}
                  className={`flex gap-3 ${item.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-[90%] flex-col ${
                      item.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`rounded-[18px] px-4 py-3 text-sm leading-7 shadow-sm ${
                        item.role === "user"
                          ? "bg-gradient-to-br from-indigo-500 via-violet-500 to-blue-500 text-white"
                          : "border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      <div>{item.content}</div>
                    </div>
                  </div>
                </div>
              ))}

              {showAssistantThinking ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                  <span className="dot-flashing" />
                  助手处理中...
                </div>
              ) : null}
            </div>

            <div className="mt-3 rounded-[22px] border border-slate-200/80 bg-white p-3">
              <div className="mb-3 flex justify-end">
                <div
                  className="inline-flex rounded-full bg-slate-100 p-1"
                  role="tablist"
                  aria-label="输入方式切换"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeInputMode === "voice"}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      activeInputMode === "voice"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-500 hover:text-indigo-600"
                    }`}
                    disabled={!isSupported || isRecording}
                    onClick={() => handleInputModeChange("voice")}
                  >
                    <Mic size={14} />
                    语音输入
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeInputMode === "text"}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      activeInputMode === "text"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    disabled={isRecording}
                    onClick={() => handleInputModeChange("text")}
                  >
                    <Keyboard size={14} />
                    文字输入
                  </button>
                </div>
              </div>

              {activeInputMode === "voice" ? (
                <div className="rounded-[20px] bg-slate-50/80 px-4 py-5">
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`voice-orb ${isRecording ? "is-recording" : "is-idle"} ${
                        isVoiceActionDisabled ? "opacity-70" : ""
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={voiceButtonLabel}
                        className={`relative z-10 flex h-[88px] w-[88px] items-center justify-center rounded-full border border-white/70 bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 text-white shadow-[0_16px_30px_rgba(99,102,241,0.24)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-80 ${
                          isRecording ? "animate-pulse" : ""
                        }`}
                        disabled={isVoiceActionDisabled}
                        onClick={voiceAction}
                      >
                        {isRecording ? <Square size={30} /> : <Mic size={32} />}
                      </button>
                    </div>

                    <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-900">
                      {voiceButtonLabel}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{voiceSecondaryText}</p>
                    {recorderStatus && recorderStatus !== "待命" ? (
                      <p className="mt-1 text-xs text-slate-400">麦克风状态：{recorderStatus}</p>
                    ) : null}
                  </div>

                  {showStopAction ? (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-rose-500"
                        onClick={() => stopCurrentFlow()}
                      >
                        <Square size={12} />
                        停止播报
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  className="rounded-[20px] bg-slate-50/80 p-3"
                  role="tabpanel"
                  aria-label="文字输入面板"
                >
                  <div className="flex gap-3">
                    <textarea
                      className="min-h-[84px] flex-1 resize-none rounded-[16px] border border-transparent bg-white px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-300"
                      placeholder="输入你想对数字人说的话"
                      value={inputText}
                      onChange={(event) => setInputText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSendTextMessage();
                        }
                      }}
                    />

                    <button
                      type="button"
                      className="inline-flex items-center gap-2 self-end rounded-[16px] bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-medium text-white shadow-[0_12px_22px_rgba(99,102,241,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={busy || isRecording || !inputText.trim()}
                      onClick={handleSendTextMessage}
                    >
                      <SendHorizontal size={18} />
                      发送
                    </button>
                  </div>

                  {showStopAction ? (
                    <div className="mt-3 flex justify-start">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-rose-500"
                        onClick={() => stopCurrentFlow()}
                      >
                        <Square size={12} />
                        停止播报
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} className="hidden" />
    </section>
  );
}