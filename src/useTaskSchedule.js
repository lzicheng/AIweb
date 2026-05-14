import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTimelineState,
  buildOccurrenceKey,
  getTaskAtIndex,
} from "./taskTimeline";
import { buildTaskAnnouncement } from "./taskAnnouncer";
import { DAILY_TASKS } from "./dailyTasks";

export function useTaskSchedule({
  playbackService,
  onTaskChange,
  intervalMs = 1000,
  announceEnabled = true,
}) {
  const [now, setNow] = useState(() => new Date());
  const announcedOccurrencesRef = useRef(new Set());
  const mountedRef = useRef(true);

  const timeline = useMemo(() => buildTimelineState(now), [now]);

  const currentOccurrence = timeline.center;
  const currentTask = getTaskAtIndex(DAILY_TASKS, currentOccurrence.baseIndex);
  const currentOccurrenceKey = buildOccurrenceKey(currentOccurrence);

  const nextOccurrence = timeline.next;
  const nextTask = nextOccurrence
    ? getTaskAtIndex(DAILY_TASKS, nextOccurrence.baseIndex)
    : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (mountedRef.current) {
        setNow(new Date());
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  useEffect(() => {
    if (!announceEnabled) return;
    if (!timeline.isArrived) return;
    if (!playbackService) return;

    const key = currentOccurrenceKey;
    if (announcedOccurrencesRef.current.has(key)) return;

    const announcement = buildTaskAnnouncement(currentTask, currentOccurrence.baseIndex);
    if (!announcement) return;

    playbackService.queueContent({
      text: announcement,
      source: "schedule",
    });

    announcedOccurrencesRef.current.add(key);

    onTaskChange?.({
      occurrence: currentOccurrence,
      task: currentTask,
      announcement,
    });
  }, [
    announceEnabled,
    currentOccurrence.baseIndex,
    currentOccurrenceKey,
    currentTask,
    onTaskChange,
    playbackService,
    timeline.isArrived,
  ]);

  const resetAnnouncements = () => {
    announcedOccurrencesRef.current.clear();
  };

  const getAnnouncedKeys = () => {
    return Array.from(announcedOccurrencesRef.current);
  };

  return {
    currentOccurrence,
    currentTask,
    currentOccurrenceKey,
    isArrived: timeline.isArrived,
    isCompleted: timeline.isCompleted,
    minutesToArrive: timeline.minutesToArrive,
    minutesToMove: timeline.minutesToMove,
    nextOccurrence,
    nextTask,
    timeline,
    resetAnnouncements,
    getAnnouncedKeys,
  };
}