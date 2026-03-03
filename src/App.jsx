import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CalendarClock,
  Clock3,
  MessageSquareText,
  SendHorizontal,
  Sparkles,
  Workflow,
} from "lucide-react";

const DAILY_TASKS = [
  {
    time: "14:00",
    title: "开始",
    steps: ["初始化资源", "加载当天运行参数", "检查依赖服务与权限状态"],
  },
  {
    time: "14:30",
    title: "数据同步",
    steps: ["拉取业务数据与监控指标", "进行基础校验与缺失修复", "输出同步摘要与异常告警"],
  },
  {
    time: "15:15",
    title: "任务执行中",
    steps: ["启动实时数据处理流水线", "执行模型训练/推理任务", "监控资源与吞吐，处理重试"],
  },
  {
    time: "15:30",
    title: "系统部署",
    steps: ["发布构建产物", "执行灰度/回滚策略检查", "进行系统健康检查与验收"],
  },
  {
    time: "16:00",
    title: "验证完成",
    steps: ["验收核心流程", "归档执行结果与日志", "生成日报并通知相关人"],
  },
  {
    time: "16:13",
    title: "验证完成后续",
    steps: ["验收核心流程", "归档执行结果与日志", "生成日报并通知相关人"],
  },
  {
    time: "16:14",
    title: "验证完成后续",
    steps: ["验收核心流程", "归档执行结果与日志", "生成日报并通知相关人"],
  },
  {
    time: "16:15",
    title: "验证完成后续",
    steps: ["验收核心流程", "归档执行结果与日志", "生成日报并通知相关人"],
  },
  {
    time: "16:30",
    title: "验证完成后续",
    steps: ["验收核心流程", "归档执行结果与日志", "生成日报并通知相关人", "归档执行结果与日志", "生成日报并通知相关人", "归档执行结果与日志", "归档执行结果与日志", "归档执行结果与日志", "归档执行结果与日志", "归档执行结果与日志", "归档执行结果与日志", "归档执行结果与日志",],
  },
];

const API_URL = "/teams/ops_team/runs";

const toMinute = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const modulo = (value, length) => ((value % length) + length) % length;

const generateSessionId = () => String(Math.floor(10000000 + Math.random() * 90000000));

const formatDuration = (minutesLeft) => {
  const safe = Math.max(0, Math.ceil(minutesLeft));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m} 分钟`;
  return `${h} 小时 ${m} 分钟`;
};

const extractAssistantText = (data) => {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return "接口未返回有效内容。";

  const pickString = (...values) =>
    values.find((v) => typeof v === "string" && v.trim().length > 0);

  // 只取“最终回复”优先字段：后端 runs 接口返回的是 content
  const direct = pickString(data.content, data.reply, data.text);
  if (direct) return direct;

  // 兼容一些常见嵌套结构/不同后端格式
  const nested = pickString(
    data?.data?.content,
    data?.result?.content,
    data?.output?.content,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.delta?.content,
    typeof data?.message === "object" ? data?.message?.content : undefined,
  );
  if (nested) return nested;

  // 错误信息兜底（FastAPI 常见为 detail）
  const detail = pickString(data.detail, data.error, data.error_message, data.message);
  if (detail) return detail;

  return JSON.stringify(data, null, 2);
};

const minutesBetween = (a, b) => (b.getTime() - a.getTime()) / 60000;
const toDayTime = (baseDate, hhmm, dayOffset = 0) => {
  const d = new Date(baseDate);
  const [hh, mm] = hhmm.split(":").map(Number);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;

const buildTimelineState = (now) => {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  const taskCount = DAILY_TASKS.length;
  const occurrences = [];
  for (const dayOffset of [-1, 0, 1, 2]) {
    for (let i = 0; i < taskCount; i += 1) {
      const task = DAILY_TASKS[i];
      const start = toDayTime(base, task.time, dayOffset);
      const nextIndex = (i + 1) % taskCount;
      const nextDayOffset = dayOffset + (nextIndex === 0 ? 1 : 0);
      const moveAt = toDayTime(base, DAILY_TASKS[nextIndex].time, nextDayOffset);
      const completeAt = new Date(start.getTime() + 10 * 60 * 1000);
      occurrences.push({
        baseIndex: i,
        start,
        moveAt,
        completeAt,
      });
    }
  }

  occurrences.sort((a, b) => a.start.getTime() - b.start.getTime());

  let centerOccIdx = occurrences.findIndex((o) => o.moveAt.getTime() > now.getTime());
  if (centerOccIdx === -1) centerOccIdx = occurrences.length - 1;

  // 中间固定为“第一个未完成”的任务点（到达后+10分钟才算完成）
  const window = [];
  for (let k = -2; k <= 2; k += 1) {
    window.push(occurrences[centerOccIdx + k]);
  }

  const center = window[2];
  const prev = window[1];
  const next = window[3];

  const isArrived = now.getTime() >= center.start.getTime();
  const isCompleted = now.getTime() >= center.completeAt.getTime();

  // 进度（严格按系统时间）：在 prev.moveAt -> center.start 之间从“上一个点”推进到“中心点”
  // 到达后在 center.start -> center.moveAt 之间从“中心点”推进到“下一个点”
  let progressFromIndex = 2;
  let progressToIndex = 2;
  let progressT = 0;
  if (!isArrived) {
    progressFromIndex = 1;
    progressToIndex = 2;
    const denom = Math.max(1, minutesBetween(prev.moveAt, center.start));
    progressT = clamp01(minutesBetween(prev.moveAt, now) / denom);
  } else {
    progressFromIndex = 2;
    progressToIndex = 3;
    const denom = Math.max(1, minutesBetween(center.start, center.moveAt));
    progressT = clamp01(minutesBetween(center.start, now) / denom);
  }

  const minutesToArrive = Math.max(0, minutesBetween(now, center.start));
  const minutesToMove = Math.max(0, minutesBetween(now, center.moveAt));

  return {
    window,
    centerOccIdx,
    progressFromIndex,
    progressToIndex,
    progressT,
    isArrived,
    isCompleted,
    minutesToArrive,
    minutesToMove,
    nextOccurrence: next,
  };
};

function TimelineTab() {
  const [now, setNow] = useState(() => new Date());
  const timeline = useMemo(() => buildTimelineState(now), [now]);
  const axisRef = useRef(null);
  const dotRefs = useRef([]);
  const [axisWidth, setAxisWidth] = useState(null);
  const [dotCenters, setDotCenters] = useState([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const axisEl = axisRef.current;
      if (!axisEl) return;

      const axisRect = axisEl.getBoundingClientRect();
      const centers = dotRefs.current.slice(0, 5).map((el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 - axisRect.left;
      });

      if (centers.every((v) => typeof v === "number")) {
        setAxisWidth(axisRect.width);
        setDotCenters(centers);
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [timeline.centerOccIdx]);

  const fillPx = useMemo(() => {
    if (!axisWidth || dotCenters.length !== 5) return null;
    const from = dotCenters[timeline.progressFromIndex];
    const to = dotCenters[timeline.progressToIndex];
    if (typeof from !== "number" || typeof to !== "number") return null;
    const x = lerp(from, to, timeline.progressT);
    return Math.max(0, Math.min(axisWidth, x));
  }, [
    axisWidth,
    dotCenters,
    timeline.progressFromIndex,
    timeline.progressToIndex,
    timeline.progressT,
  ]);

  const focusOcc = timeline.window[2];
  const focusTask = DAILY_TASKS[focusOcc.baseIndex];
  const nextOcc = timeline.nextOccurrence;
  const nextTask = nextOcc ? DAILY_TASKS[nextOcc.baseIndex] : DAILY_TASKS[0];
  const focusSteps = useMemo(() => {
    if (!focusTask) return [];
    if (Array.isArray(focusTask.steps)) return focusTask.steps.filter(Boolean);
    const desc = typeof focusTask.description === "string" ? focusTask.description.trim() : "";
    return desc ? [desc] : [];
  }, [focusTask]);

  return (
    <section className="relative h-full overflow-hidden rounded-[28px] border border-white/40 bg-white/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            <Sparkles size={14} />
            实时任务轨迹
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">操作时序轴</h2>
          <p className="mt-2 text-sm text-slate-500">深圳农商银行一线操作时序轴</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-right shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">当前时间</p>
          <p className="text-2xl font-semibold text-slate-800">{now.toLocaleTimeString("zh-CN")}</p>
        </div>
      </div>

      <div className="relative mt-10 rounded-3xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-8">
        <div ref={axisRef} className="relative -mx-8 px-8">
          {/* 轴线中心与任务点中心对齐：点中心在32px（h-16的50%），线高6px => top=32-3=29 */}
          <div className="absolute left-0 right-0 top-[29px] h-[6px] rounded-full bg-slate-200/80" />
          <motion.div
            className="absolute left-0 top-[29px] h-[6px] rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-cyan-400 shadow-[0_0_18px_rgba(16,185,129,0.40)]"
            animate={{ width: fillPx === null ? 0 : `${fillPx}px` }}
            transition={{ type: "spring", damping: 26, stiffness: 140 }}
          />
          <motion.div
            className="absolute top-[29px] h-[6px] w-12 rounded-full bg-white/80 blur-[2px]"
            animate={{ left: fillPx === null ? "-1.4rem" : `calc(${fillPx}px - 1.4rem)` }}
            transition={{ type: "spring", damping: 26, stiffness: 140 }}
          />

          <div className="relative z-10 grid grid-cols-5 gap-4">
            {timeline.window.map((occ, i) => {
              const task = DAILY_TASKS[occ.baseIndex];
              const isCenter = i === 2;
              const arrived = now.getTime() >= occ.start.getTime();
              const past = now.getTime() >= occ.completeAt.getTime();
              const status = past ? "past" : isCenter ? (arrived ? "current" : "upcoming") : "future";
              const isCurrent = status === "current";

              return (
                <div key={`${occ.start.toISOString()}-${task.time}`} className="flex flex-col items-center text-center">
                  <div className="relative h-16 w-full">
                    {isCurrent ? (
                      <motion.span
                        className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300/40 blur-md"
                        animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0.8, 0.45] }}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                      />
                    ) : null}
                    <motion.div
                      ref={(el) => {
                        dotRefs.current[i] = el;
                      }}
                      className={`timeline-dot absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border ${status === "past"
                        ? "border-emerald-200 bg-emerald-400"
                        : status === "current"
                          ? "border-yellow-200 bg-yellow-400"
                          : status === "upcoming"
                            ? "border-yellow-100 bg-amber-300"
                            : "border-yellow-100 bg-amber-300"
                        }`}
                      animate={
                        isCurrent
                          ? {
                            scale: [1, 1.14, 1],
                            boxShadow: [
                              "0 0 0 rgba(250,204,21,0.35)",
                              "0 0 24px rgba(250,204,21,0.95)",
                              "0 0 0 rgba(250,204,21,0.35)",
                            ],
                          }
                          : { scale: 1, boxShadow: "0 0 0 rgba(0,0,0,0)" }
                      }
                      transition={
                        isCurrent
                          ? {
                            duration: 1.7,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                          }
                          : { duration: 0 }
                      }
                    />
                  </div>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{task.time}</p>
                  <p className="mt-1 text-sm font-medium text-slate-600">{task.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-cyan-50 p-5">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CalendarClock size={16} />
            当前任务
          </p>
          <h3 className="text-2xl font-semibold text-slate-900">
            {focusTask.time} · {focusTask.title}
          </h3>
          {focusSteps.length ? (
            <ul className="mt-3 space-y-2 text-slate-700">
              {focusSteps.map((step, idx) => (
                <li key={`${focusTask.time}-${idx}`} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {timeline.isArrived ? (
            <p className="mt-3 text-sm text-slate-700">
              已到达该节点，距离下一任务还有 <span className="font-semibold">{formatDuration(timeline.minutesToMove)}</span>。
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-700">
              距离下一任务开始约 <span className="font-semibold">{formatDuration(timeline.minutesToArrive)}</span>。
            </p>
          )}
          <p className="mt-2 text-sm text-slate-600">
            下一节点：{nextTask.time} {nextTask.title}
          </p>
        </div>
      </div>
    </section>
  );
}

function ChatTab({
  messages,
  setMessages,
  input,
  setInput,
  loading,
  setLoading,
  sessionId,
  onNewChat,
}) {
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const activeSessionRef = useRef(sessionId);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    activeSessionRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    isNearBottomRef.current = true;
  }, [messages, loading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!isNearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    isNearBottomRef.current = true;
  }, [sessionId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      abortRef.current?.abort?.();
      const controller = new AbortController();
      abortRef.current = controller;
      const sessionAtSend = sessionId;

      const form = new FormData();
      form.append("message", text);
      form.append("stream", "false");
      form.append("monitor", "");
      form.append("session_id", sessionAtSend);
      form.append("user_id", "");
      form.append("version", "");
      form.append("background", "");

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { accept: "application/json" },
        body: form,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`接口异常：${response.status}`);
      }

      const data = await response.json();
      if (sessionAtSend !== activeSessionRef.current) return;
      const assistantText = extractAssistantText(data);
      setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `请求失败：${error instanceof Error ? error.message : "未知错误"}。请检查 API 地址与后端服务。`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/40 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
            <MessageSquareText size={14} />
            AI 运维
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">运维助手</h2>
          <p className="mt-1 text-sm text-slate-500">深圳农商银行运维助手</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              abortRef.current?.abort?.();
              onNewChat?.();
            }}
            disabled={loading}
            title="清空对话并开始新的会话"
          >
            <Sparkles size={16} />
            新对话
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          const threshold = 64;
          const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
          isNearBottomRef.current = distance <= threshold;
        }}
        className="chat-scroll min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-5"
      >
        {messages.map((msg, idx) => (
          <div key={`${msg.role}-${idx}`} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" ? (
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                <Bot size={16} />
              </div>
            ) : null}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${msg.role === "user"
                ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-800"
                }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" ? (
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                我
              </div>
            ) : null}
          </div>
        ))}
        {loading ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <span className="dot-flashing" />
            助手正在思考...
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl border border-slate-200 bg-white/90 p-2">
        <input
          className="flex-1 rounded-xl border border-transparent bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-emerald-400 focus:bg-white"
          placeholder="输入你的问题..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendMessage();
            }
          }}
        />
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={sendMessage}
        >
          <SendHorizontal size={18} />
          发送
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">支持多轮对话</p>
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState("timeline");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "你好，我是运维助手。你可以直接输入问题，我会通过后端 API 返回结果。" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(() => generateSessionId());

  return (
    <div className="dashboard-bg h-screen w-screen overflow-hidden text-slate-900">
      <div className="grid h-full w-full grid-cols-[240px_1fr] gap-5 p-3">
        <aside className="rounded-[24px] border border-white/40 bg-white/60 p-4 shadow-[0_20px_50px_rgba(30,41,59,0.12)] backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-lg">
              <Bot size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Ops Console</h1>
              <p className="text-xs text-slate-500">GPT Style UI</p>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              type="button"
              onClick={() => setTab("timeline")}
              className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${tab === "timeline"
                ? "bg-slate-900 text-white shadow-lg"
                : "bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
            >
              <Clock3 size={18} className="shrink-0" />
              <span className="font-medium">操作时序轴</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${tab === "chat"
                ? "bg-slate-900 text-white shadow-lg"
                : "bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
            >
              <Workflow size={18} className="shrink-0" />
              <span className="font-medium">运维助手</span>
            </button>
          </nav>
        </aside>

        <main className="h-full min-h-0 min-w-0 rounded-[24px] border border-white/40 bg-white/30 p-3 backdrop-blur-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="h-full min-h-0"
            >
              {tab === "timeline" ? (
                <TimelineTab />
              ) : (
                <ChatTab
                  messages={chatMessages}
                  setMessages={setChatMessages}
                  input={chatInput}
                  setInput={setChatInput}
                  loading={chatLoading}
                  setLoading={setChatLoading}
                  sessionId={chatSessionId}
                  onNewChat={() => {
                    setChatLoading(false);
                    setChatInput("");
                    setChatMessages([
                      {
                        role: "assistant",
                        content: "已开始新对话。请继续输入你的问题，我会通过后端 API 返回结果。",
                      },
                    ]);
                    setChatSessionId(generateSessionId());
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
