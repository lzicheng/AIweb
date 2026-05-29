import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { APP_CONFIG } from "./appConfig";
import { DAILY_TASKS } from "./dailyTasks";
import {
  buildTimelineState,
  formatDuration,
  lerp,
  clamp01,
  normalizeTaskSteps,
} from "./taskTimeline";
import { fetchStepStatusMap } from "./stepStatusApi";
import { buildFocusTaskSteps, summarizeFocusTaskSteps } from "./timelineStepState";

const STEP_STATUS_API_URL = APP_CONFIG.stepStatusApiUrl;

const STEP_STATUS_LABELS = {
  pending: "待开始",
  running: "执行中",
  success: "已完成",
  error: "异常需关注",
};

const STEP_STATUS_CLASSNAMES = {
  pending: "bg-slate-100 text-slate-600",
  running: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
  error: "bg-rose-100 text-rose-700",
};

export default function TimelineTab() {
  const [now, setNow] = useState(() => new Date());
  const [externalStepStateMap, setExternalStepStateMap] = useState({});
  const [axisWidth, setAxisWidth] = useState(null);
  const [dotCenters, setDotCenters] = useState([]);

  const timeline = useMemo(() => buildTimelineState(now), [now]);
  const axisRef = useRef(null);
  const dotRefs = useRef([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    const focusOcc = timeline.center;
    const focusTask = DAILY_TASKS[focusOcc.baseIndex];
    const externalStepIds = normalizeTaskSteps(focusTask, focusOcc.baseIndex)
      .filter((step) => step.id)
      .map((step) => step.id);

    const pullStepStates = async () => {
      try {
        const nextMap = await fetchStepStatusMap({
          apiUrl: STEP_STATUS_API_URL,
          stepIds: externalStepIds,
        });
        if (disposed) return;
        setExternalStepStateMap(nextMap);
      } catch {
        // 状态服务暂不可用时，保持前端默认状态即可
      }
    };

    pullStepStates();
    const timer = window.setInterval(pullStepStates, 3000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [timeline.center.baseIndex]);

  useLayoutEffect(() => {
    const measure = () => {
      const axisElement = axisRef.current;
      if (!axisElement) return;

      const axisRect = axisElement.getBoundingClientRect();
      const centers = dotRefs.current.slice(0, 5).map((element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return rect.left + rect.width / 2 - axisRect.left;
      });

      if (centers.every((value) => typeof value === "number")) {
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
    const value = lerp(from, to, timeline.progressT);
    return Math.max(0, Math.min(axisWidth, value));
  }, [
    axisWidth,
    dotCenters,
    timeline.progressFromIndex,
    timeline.progressT,
    timeline.progressToIndex,
  ]);

  const focusOcc = timeline.center;
  const focusTask = DAILY_TASKS[focusOcc.baseIndex];
  const nextOcc = timeline.next;
  const nextTask = nextOcc ? DAILY_TASKS[nextOcc.baseIndex] : DAILY_TASKS[0];
  const focusTaskSteps = useMemo(() => {
    return buildFocusTaskSteps({
      externalStepStateMap,
      task: focusTask,
      taskIndex: focusOcc.baseIndex,
    });
  }, [externalStepStateMap, focusOcc.baseIndex, focusTask]);

  const focusTaskSummary = useMemo(() => {
    return summarizeFocusTaskSteps(focusTaskSteps);
  }, [focusTaskSteps]);

  return (
    <section
      className="relative h-full overflow-hidden rounded-[28px] border border-white/40 bg-white/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl"
    >
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            <Sparkles size={14} />
            实时任务轨迹
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            操作时序轴
          </h2>
          <p className="mt-2 text-sm text-slate-500">深圳农商银行一线操作时序轴</p>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-right shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">当前时间</p>
          <p className="text-2xl font-semibold text-slate-800">
            {now.toLocaleTimeString("zh-CN")}
          </p>
        </div>
      </div>

      <div className="relative mt-10 rounded-3xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-8">
        <div ref={axisRef} className="relative -mx-8 px-8">
          <div className="absolute left-0 right-0 top-[29px] h-[6px] rounded-full bg-slate-200/80" />

          <motion.div
            className="absolute left-0 top-[29px] h-[6px] rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-cyan-400 shadow-[0_0_18px_rgba(16,185,129,0.40)]"
            animate={{ width: fillPx === null ? 0 : `${fillPx}px` }}
            transition={{ type: "spring", damping: 26, stiffness: 140 }}
          />

          <motion.div
            className="absolute top-[29px] h-[6px] w-12 rounded-full bg-white/80 blur-[2px]"
            animate={{
              left: fillPx === null ? "-1.4rem" : `calc(${fillPx}px - 1.4rem)`,
            }}
            transition={{ type: "spring", damping: 26, stiffness: 140 }}
          />

          <div className="relative z-10 grid grid-cols-5 gap-4">
            {timeline.window.map((occ, index) => {
              const task = DAILY_TASKS[occ.baseIndex];
              const isCenter = index === 2;
              const arrived = now.getTime() >= occ.start.getTime();
              const past = now.getTime() >= occ.completeAt.getTime();
              const status = past
                ? "past"
                : isCenter
                  ? arrived
                    ? "current"
                    : "upcoming"
                  : "future";
              const isCurrent = status === "current";

              return (
                <div
                  key={`${occ.start.toISOString()}-${task.time}`}
                  className="flex flex-col items-center text-center"
                >
                  <div className="relative h-16 w-full">
                    {isCurrent ? (
                      <motion.span
                        className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300/40 blur-md"
                        animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0.8, 0.45] }}
                        transition={{
                          duration: 2,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }}
                      />
                    ) : null}

                    <motion.div
                      ref={(element) => {
                        dotRefs.current[index] = element;
                      }}
                      className={`timeline-dot absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                        status === "past"
                          ? "border-emerald-200 bg-emerald-400"
                          : status === "current"
                            ? "border-yellow-200 bg-yellow-400"
                            : "border-yellow-100 bg-amber-300"
                      }`}
                      animate={
                        isCurrent
                          ? {
                              boxShadow: [
                                "0 0 0 rgba(250,204,21,0.35)",
                                "0 0 24px rgba(250,204,21,0.95)",
                                "0 0 0 rgba(250,204,21,0.35)",
                              ],
                              scale: [1, 1.14, 1],
                            }
                          : { boxShadow: "0 0 0 rgba(0,0,0,0)", scale: 1 }
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

          {focusTaskSteps.length ? (
            <ul className="mt-3 space-y-2 text-slate-700">
              {focusTaskSteps.map((step, index) => (
                <li key={`${focusTask.time}-${index}`} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="leading-relaxed">{step.text}</p>
                    {step.id ? (
                      <>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                              STEP_STATUS_CLASSNAMES[step.status] ||
                              STEP_STATUS_CLASSNAMES.pending
                            }`}
                          >
                            {STEP_STATUS_LABELS[step.status] || step.status || STEP_STATUS_LABELS.pending}
                          </span>
                        </div>
                        {step.message ? (
                          <p className="mt-1 text-xs text-slate-500">{step.message}</p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-3 text-sm text-slate-700">{focusTaskSummary}</p>

          {timeline.isArrived ? (
            <p className="mt-2 text-sm text-slate-700">
              已到达该节点，距离下一任务还有{" "}
              <span className="font-semibold">{formatDuration(timeline.minutesToMove)}</span>
              。
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-700">
              距离下一任务开始约{" "}
              <span className="font-semibold">{formatDuration(timeline.minutesToArrive)}</span>
              。
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