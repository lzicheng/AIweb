import { DAILY_TASKS } from "./dailyTasks";

const EXTERNAL_STATUS_FALLBACK = "pending";

export const minutesBetween = (a, b) => (b.getTime() - a.getTime()) / 60000;

export const timeToMinutes = (hhmm) => {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
};

export const toDayTime = (baseDate, hhmm, dayOffset = 0) => {
  const date = new Date(baseDate);
  const [hh, mm] = hhmm.split(":").map(Number);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hh, mm, 0, 0);
  return date;
};

export const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export const formatDuration = (minutesLeft) => {
  const safe = Math.max(0, Math.ceil(minutesLeft));
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  if (hour === 0) return `${minute} 分钟`;
  return `${hour} 小时 ${minute} 分钟`;
};

const makeStepId = (task, taskIndex, stepIndex) =>
  `${task.time.replace(":", "")}-${taskIndex + 1}-${stepIndex + 1}`;

export const normalizeStep = (rawStep, task, taskIndex, stepIndex) => {
  if (typeof rawStep === "string") {
    return {
      id: makeStepId(task, taskIndex, stepIndex),
      text: rawStep,
      controlMode: "auto",
    };
  }

  if (!rawStep || typeof rawStep !== "object") return null;

  const text = typeof rawStep.text === "string" ? rawStep.text.trim() : "";
  if (!text) return null;

  return {
    id:
      typeof rawStep.id === "string" && rawStep.id.trim()
        ? rawStep.id
        : makeStepId(task, taskIndex, stepIndex),
    text,
    controlMode: rawStep.controlMode === "external" ? "external" : "auto",
  };
};

export const normalizeTaskSteps = (task, taskIndex) => {
  const rawSteps = Array.isArray(task?.steps) ? task.steps : [];
  return rawSteps
    .map((step, stepIndex) => normalizeStep(step, task, taskIndex, stepIndex))
    .filter(Boolean);
};

export const getExternalStepIds = (task, taskIndex) =>
  normalizeTaskSteps(task, taskIndex)
    .filter((step) => step.controlMode === "external")
    .map((step) => step.id);

export const normalizeExternalStatus = (status) => {
  if (
    status === "running" ||
    status === "success" ||
    status === "error" ||
    status === "pending"
  ) {
    return status;
  }
  return EXTERNAL_STATUS_FALLBACK;
};

export const buildOccurrenceKey = (occurrence) =>
  `${occurrence.start.toISOString()}-${occurrence.baseIndex}`;

export const buildTimelineState = (now, tasks = DAILY_TASKS) => {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  const occurrences = [];
  for (const dayOffset of [-1, 0, 1, 2]) {
    for (let index = 0; index < tasks.length; index += 1) {
      const task = tasks[index];
      const start = toDayTime(base, task.time, dayOffset);
      const nextIndex = (index + 1) % tasks.length;
      const nextTask = tasks[nextIndex];
      const nextDayOffset =
        dayOffset +
        (timeToMinutes(nextTask.time) < timeToMinutes(task.time) ? 1 : 0);
      const moveAt = toDayTime(base, nextTask.time, nextDayOffset);
      const completeAt = new Date(start.getTime() + 10 * 60 * 1000);

      occurrences.push({
        baseIndex: index,
        completeAt,
        moveAt,
        start,
      });
    }
  }

  occurrences.sort((a, b) => a.start.getTime() - b.start.getTime());

  let centerOccIdx = occurrences.findIndex(
    (item) => item.moveAt.getTime() > now.getTime()
  );
  if (centerOccIdx === -1) centerOccIdx = occurrences.length - 1;

  const window = [];
  for (let offset = -2; offset <= 2; offset += 1) {
    window.push(occurrences[centerOccIdx + offset]);
  }

  const center = window[2];
  const previous = window[1];
  const next = window[3];

  const isArrived = now.getTime() >= center.start.getTime();
  const isCompleted = now.getTime() >= center.completeAt.getTime();

  let progressFromIndex = 2;
  let progressToIndex = 2;
  let progressT = 0;

  if (!isArrived) {
    progressFromIndex = 1;
    progressToIndex = 2;
    const approachStart = previous?.start ?? center.start;
    const denominator = Math.max(1, minutesBetween(approachStart, center.start));
    progressT = clamp01(minutesBetween(approachStart, now) / denominator);
  } else {
    progressFromIndex = 2;
    progressToIndex = 3;
    const denominator = Math.max(1, minutesBetween(center.start, center.moveAt));
    progressT = clamp01(minutesBetween(center.start, now) / denominator);
  }

  return {
    center,
    centerOccIdx,
    occurrences,
    isArrived,
    isCompleted,
    minutesToArrive: Math.max(0, minutesBetween(now, center.start)),
    minutesToMove: Math.max(0, minutesBetween(now, center.moveAt)),
    next,
    previous,
    progressFromIndex,
    progressT,
    progressToIndex,
    window,
  };
};

export const getTaskAtIndex = (tasks = DAILY_TASKS, baseIndex) => {
  return tasks[baseIndex];
};