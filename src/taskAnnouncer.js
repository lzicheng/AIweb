import { normalizeTaskSteps } from "./taskTimeline";

export const buildTaskAnnouncement = (task, baseIndex) => {
  if (!task) return null;

  const timeLabel = task.time;
  const title = task.title;

  const steps = normalizeTaskSteps(task, baseIndex);
  const firstStepText = steps.length > 0 ? steps[0].text : null;

  const parts = [];

  parts.push(`现在是${timeLabel}，${title}任务已开始。`);

  if (firstStepText) {
    parts.push(`第一步：${firstStepText}`);
  }

  if (steps.length > 1) {
    parts.push(`该任务共${steps.length}个步骤。`);
  }

  return parts.join(" ");
};

export const buildApproachingAnnouncement = (task, minutesToArrive) => {
  if (!task) return null;

  const timeLabel = task.time;
  const title = task.title;

  const minutes = Math.ceil(minutesToArrive);

  if (minutes <= 1) {
    return `${timeLabel}的${title}任务即将开始，请做好准备。`;
  }

  if (minutes <= 5) {
    return `${timeLabel}的${title}任务将在${minutes}分钟后开始。`;
  }

  return null;
};