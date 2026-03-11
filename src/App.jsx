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
    time: "8:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "后置报表（查看行长报表是否已出）",
      "ADS流量巡检",
      "三条IPV6线路流量巡检",
      "二代生产HMC巡检",
      "生产区、OA区数据库延时巡检并将结果发送至微信‘系统运营群’",
      "远程运维应急方案“数仓批处理时间”权限关闭"
    ],
  },
  {
    time: "8:30",
    title: "批处理",
    steps: [
      "检查理财3.0批处理日启清算是否已运行",
      "检查理财6.0批处理日启清算是否已运行（工作日做）"
    ],
  },
  {
    time: "9:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      { id: "7", text: "后置一体机数据库巡检（sdata）", controlMode: "external" },
      "ADS流量巡检",
      "三条IPV6线路流量巡检",
      "二代生产HMC巡检",
      "短信平台巡检",
      "Oracle数据库空间可用性巡检",
      "远程运维应急方案“每周一执行”权限开启（每周一做）"
    ],
  },
  {
    time: "9:30",
    title: "日常巡检和批处理",
    steps: [
      "远程运维应急方案“每周一执行”权限关闭（每周一做）",
      "Neteagle(支行线路故障)",
      "Neteagle(离行点线路故障)旬末检查上报",
      "检查理财6.0批处理的理财清算日启是否完成（非工作日检查）",
      "积分系统批处理巡检"
    ],
  },
  {
    time: "10:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "IP封堵检查",
      "光纤交换机端口状态巡检",
      "二代生产HMC巡检"
    ],
  },
  {
    time: "11:00",
    title: "日常巡检和批处理",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "ADS流量巡检",
      "三条IPV6线路流量巡检",
      "Neteagle(支行线路故障)",
      "Neteagle(离行点线路故障)旬末检查上报",
      "检查理财3.0批处理日启清算是否已完成",
      "执行理财6.0批处理的交易中心清算日启是否已完成（非工作日做）"
    ],
  },
  {
    time: "12:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "二代生产HMC巡检",
      "二代核心开发HMC巡检",
      "12:00~14:00关注即时通“运营技术支持群”是否有网点反馈问题信息"
    ],
  },
  {
    time: "13:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "二代生产HMC巡检",
      "12:00~14:00关注即时通“运营技术支持群”是否有网点反馈问题信息"
    ],
  },
  {
    time: "14:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "存储、交换机巡检",
      "ADS流量巡检",
      "三条IPV6线路流量巡检"
    ],
  },
  {
    time: "15:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "二代生产HMC巡检",
      "IP封堵检查"
    ],
  },
  {
    time: "16:00",
    title: "日常巡检和批处理",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "检查理财6.0批处理的理财清算日终是否完成（非工作日检查）"
    ],
  },
  {
    time: "16:30",
    title: "批处理和变更日志",
    steps: [
      "执行理财3.0批处理的日终清算（非工作日做）",
      "每日变更日志收集"
    ],
  },
  {
    time: "17:00",
    title: "日常巡检和其他",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "二代生产HMC巡检",
      "每日变更日志收集表格发送至即时通“科技运营部业务连续性工作群”",
      "验证远程运维方案可用性（使用专用笔记本验证）"
    ],
  },
  {
    time: "18:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "IP封堵检查",
      "ADS流量巡检",
      "三条IPV6线路流量巡检",
      "二代生产HMC巡检",
      "短信平台巡检"
    ],
  },
  {
    time: "18:30",
    title: "批处理",
    steps: [
      "检查理财3.0批处理的日终清算是否完成，及系统是否日切到第二天的日期",
      "检查理财6.0批处理的日终清算是否完成，及系统是否日切到第二天的日期"
    ],
  },
  {
    time: "19:00",
    title: "应急预案备份",
    steps: [
      "应急预案电子文档备份"
    ],
  },
  {
    time: "19:30",
    title: "值班信息发送",
    steps: [
      "发送第二天机房值班人员信息至微信“运行组两地工作沟通群”"
    ],
  },
  {
    time: "20:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      { id: "7", text: "后置一体机数据库巡检（sdata）", controlMode: "external" },
      "ADS流量巡检",
      "三条IPV6线路流量巡检",
      "二代生产HMC巡检",
      "光纤交换机端口状态巡检"
    ],
  },
  {
    time: "20:30",
    title: "应急预案权限开启",
    steps: [
      "远程运维应急方案“财务类系统批处理时间”权限开启"
    ],
  },
  {
    time: "21:00",
    title: "日常巡检",
    steps: [
      "IP封堵检查",
      "二代生产HMC巡检",
      "电话银行巡检（拨打三个电话）",
      "短信平台巡检",
      "后置报表（检查是否还存在跑批任务）",
      "Oracle数据库空间可用性巡检",
      "OA区数据库延时巡检",
      "重启罗湖机房场地监控系统客户端"
    ],
  },
  {
    time: "21:45",
    title: "应急预案权限开启",
    steps: [
      "远程运维应急方案“数仓、LOS批处理时间”权限开启"
    ],
  },
  {
    time: "22:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "二代生产HMC巡检",
      "远程运维应急方案“三代核心批处理时间”权限开启"
    ],
  },
  {
    time: "22:30",
    title: "其他",
    steps: [
      "检查机房钥匙、移动操作台领用登记情况"
    ],
  },
  {
    time: "23:00",
    title: "日常巡检和批处理",
    steps: [
      { id: "8", text: "外围系统ORACLE数据库巡检", controlMode: "external" },
      "IP封堵检查",
      "ADS流量巡检",
      "三条IPV6线路流量巡检",
      "二代生产HMC巡检",
      "提交三代核心批处理【三代核心联合主批】"
    ],
  },
  {
    time: "23:05",
    title: "影像系统例行重启",
    steps: [
      "影像系统例行重启（每周二晚，三代核心提批后操作）"
    ],
  },
  {
    time: "00:00",
    title: "日常巡检和批处理",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      { id: "7", text: "后置一体机数据库巡检（sdata）", controlMode: "external" },
      "二代生产HMC巡检",
      "0点日切后，检查三代核心批处理是否续跑",
      "远程运维应急方案“信用卡批处理时间”权限开启",
      "场地监控、三楼供电参数表备份并拷贝至场地监控备份专用U盘（每月1日晚班操作）"
    ],
  },
  {
    time: "00:10",
    title: "批处理",
    steps: [
      "ATMP自动批处理结果确认",
      "注：0:30之前未收到跑批结束提示信息需及时通知詹铭毅"
    ],
  },
  {
    time: "00:15",
    title: "批处理",
    steps: [
      "信用卡批处理",
      "注：0:30之前未收到信用卡跑批开始告警需立即通知信用卡值班人员"
    ],
  },
  {
    time: "00:25",
    title: "批处理",
    steps: [
      { id: "1", text: "三代生成银联对账文件检查（0:25后可检查）", controlMode: "external" }
    ],
  },
  {
    time: "00:40",
    title: "批处理",
    steps: [
      { id: "2", text: "0:40~0:50，后置文件报送任务自动SQL指令巡检", controlMode: "external" }
    ],
  },
  {
    time: "00:50",
    title: "批处理",
    steps: [
      "0:50前登录LOS跑批页面，检查节点“新核心文件处理”是否在跑",
      "注：后续每隔半小时需关注一下跑批是否正常及关键节点是否在规定时间内已运行"
    ],
  },
  {
    time: "01:00",
    title: "日常巡检和批处理",
    steps: [
      "IP封堵检查",
      "二代生产HMC巡检",
      "回单文件下载检查"
    ],
  },
  {
    time: "01:30",
    title: "批处理",
    steps: [
      "上送大总账表外账文件任务巡检（los批处理节点检查“上送保函表外账文件”是否已执行完成）"
    ],
  },
  {
    time: "01:40",
    title: "批处理",
    steps: [
      { id: "3", text: "1:40~1:50，上送大总账表外账文件任务自动SQL指令巡检", controlMode: "external" }
    ],
  },
  {
    time: "02:00",
    title: "日常巡检和批处理",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "短信平台巡检",
      "后置报表（是否能正常登录）",
      "二代生产HMC巡检",
      "财务大总账系统日常巡检（平时2:00检查，月底则是2:50检查）",
      "检查LOS批处理任务“更新押品登记机构”是否执行完成",
      "LOS回传给核心的数据检查（上送核心文件为“执行成功”即可检查）",
      "电话银行巡检（拨打三个电话）",
      { id: "4", text: "操作员外围操作检查（中间业务/渠道运行情况检查；dataexchg/integrator/网银日切检查）", controlMode: "external" }
    ],
  },
  {
    time: "02:30",
    title: "批处理",
    steps: [
      "若超过2:30分，仍未收到信用卡跑批结束告警，则按照相关步骤检查"
    ],
  },
  {
    time: "02:50",
    title: "批处理",
    steps: [
      "财务大总账系统日常巡检（平时2:00检查，月底则是2:50检查）",
      { id: "5", text: "财务资产负债批处理检查（是否开始跑批及有无报错）（月底3:20检查）", controlMode: "external" }
    ],
  },
  {
    time: "03:00",
    title: "日常巡检",
    steps: [
      { id: "7", text: "后置一体机数据库巡检（sdata）", controlMode: "external" },
      "IP封堵检查",
      "二代生产HMC巡检",
      "北塔告警、数据库延时看板确认检查（查看是否存在未通知异常告警）",
      "3:00-8:00期间可录入场地监控UPS数据电流录入（前一天数据）"
    ],
  },
  {
    time: "03:30",
    title: "批处理",
    steps: [
      { id: "6", text: "财务资产负债批处理检查（跑批是否正常完成）（月底4:00检查）", controlMode: "external" }
    ],
  },
  {
    time: "04:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "后置报表（是否能正常登录）",
      "二代生产HMC巡检"
    ],
  },
  {
    time: "05:00",
    title: "日常巡检",
    steps: [
      "IP封堵检查",
      "二代生产HMC巡检",
      "5:00左右检查销管批处理完成情况（转发钉钉提示信息）"
    ],
  },
  {
    time: "05:30",
    title: "日常巡检",
    steps: [
      "个人手机先机、有数app登录检查",
      "5:00左右检查销管批处理完成情况（转发钉钉提示信息）"
    ],
  },
  {
    time: "06:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      { id: "7", text: "后置一体机数据库巡检（sdata）", controlMode: "external" },
      "IP封堵检查",
      "ADS流量巡检",
      "三条IPV6线路流量巡检",
      "二代生产HMC巡检",
      "二代核心开发HMC巡检",
      "短信平台巡检",
      "电话银行巡检（拨打三个电话）",
      "3:00-8:00期间可录入场地监控UPS数据电流录入（前一天数据）",
    ],
  },
  {
    time: "06:30",
    title: "日常巡检",
    steps: [
      "三代柜面影像验印检查【影像采集（扫描仪）、影像采集（高拍仪）、人工验印】",
      "跑批时间统计表上传至ITIL",
      "SmartMonitor-JMS监控每日例行重启、客户端需手动"
    ],
  },
  {
    time: "07:00",
    title: "日常巡检",
    steps: [
      "巡检31个IPV4网银页（保留手动巡检）、巡检31个IPV6网银页",
      "手机银行APP登录巡检",
      "二代生产HMC巡检",
      "个人手机移动办公app（智慧办公app）检查",
      "远程运维应急方案“三代核心批处理时间”权限关闭",
      "远程运维应急方案“信用卡批处理时间”权限关闭",
      "远程运维应急方案“LOS批处理时间关闭”权限关闭",
      "远程运维应急方案“财务类系统批处理时间”权限关闭"
    ],
  },
  //{
  //  time: "15:15",
  //  title: "任务执行中",
  //  steps: [
  //    "启动实时数据处理流水线",
  //    { id: "1", text: "执行模型训练/推理任务", controlMode: "external" },
  //    "监控资源与吞吐，处理重试",
  //  ],
  //},
];

const API_URL = "/teams/ops_team/runs";
const STEP_STATES_API_URL = "/ops-events/step-states";
const EXTERNAL_STATUS_FALLBACK = "pending";

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
const timeToMinutes = (hhmm) => {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
};
const toDayTime = (baseDate, hhmm, dayOffset = 0) => {
  const d = new Date(baseDate);
  const [hh, mm] = hhmm.split(":").map(Number);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;
const makeStepId = (task, taskIndex, stepIndex) =>
  `${task.time.replace(":", "")}-${taskIndex + 1}-${stepIndex + 1}`;
const normalizeStep = (rawStep, task, taskIndex, stepIndex) => {
  if (typeof rawStep === "string") {
    return {
      id: makeStepId(task, taskIndex, stepIndex),
      text: rawStep,
      controlMode: "auto",
    };
  }
  if (!rawStep || typeof rawStep !== "object") {
    return null;
  }
  const text = typeof rawStep.text === "string" ? rawStep.text.trim() : "";
  if (!text) return null;
  return {
    id: typeof rawStep.id === "string" && rawStep.id.trim() ? rawStep.id : makeStepId(task, taskIndex, stepIndex),
    text,
    controlMode: rawStep.controlMode === "external" ? "external" : "auto",
  };
};
const normalizeTaskSteps = (task, taskIndex) => {
  const rawSteps = Array.isArray(task?.steps) ? task.steps : [];
  return rawSteps.map((step, stepIndex) => normalizeStep(step, task, taskIndex, stepIndex)).filter(Boolean);
};
const getExternalStepIds = (task, taskIndex) =>
  normalizeTaskSteps(task, taskIndex)
    .filter((step) => step.controlMode === "external")
    .map((step) => step.id);
const normalizeExternalStatus = (status) => {
  if (status === "running" || status === "success" || status === "error" || status === "pending") {
    return status;
  }
  return EXTERNAL_STATUS_FALLBACK;
};

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
      const nextTask = DAILY_TASKS[nextIndex];
      const nextDayOffset = dayOffset + (timeToMinutes(nextTask.time) < timeToMinutes(task.time) ? 1 : 0);
      const moveAt = toDayTime(base, nextTask.time, nextDayOffset);
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

  // 进度（严格按系统时间）：在 prev.start -> center.start 之间从“上一个点”推进到“中心点”
  // 到达后在 center.start -> center.moveAt 之间从“中心点”推进到“下一个点”
  let progressFromIndex = 2;
  let progressToIndex = 2;
  let progressT = 0;
  if (!isArrived) {
    progressFromIndex = 1;
    progressToIndex = 2;
    const approachStart = prev?.start ?? center.start;
    const denom = Math.max(1, minutesBetween(approachStart, center.start));
    progressT = clamp01(minutesBetween(approachStart, now) / denom);
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
  const [externalStepStateMap, setExternalStepStateMap] = useState({});
  const timeline = useMemo(() => buildTimelineState(now), [now]);
  const axisRef = useRef(null);
  const dotRefs = useRef([]);
  const clearedStepAtRef = useRef({});
  const previousFocusOccurrenceRef = useRef(null);
  const [axisWidth, setAxisWidth] = useState(null);
  const [dotCenters, setDotCenters] = useState([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;

    const pullStepStates = async () => {
      try {
        const response = await fetch(STEP_STATES_API_URL, { headers: { accept: "application/json" } });
        if (!response.ok) return;
        const data = await response.json();
        if (disposed || !Array.isArray(data?.states)) return;
        const nextMap = {};
        data.states.forEach((item) => {
          const stepId = typeof item?.stepId === "string" ? item.stepId : "";
          if (!stepId) return;
          const updatedAt = typeof item?.updatedAt === "string" ? item.updatedAt : "";
          const clearedAt = clearedStepAtRef.current[stepId];
          if (clearedAt && updatedAt && updatedAt <= clearedAt) return;
          if (clearedAt && updatedAt > clearedAt) {
            delete clearedStepAtRef.current[stepId];
          }
          nextMap[stepId] = {
            status: normalizeExternalStatus(item.status),
            message: typeof item?.message === "string" ? item.message : "",
            updatedAt,
          };
        });
        setExternalStepStateMap(nextMap);
      } catch {
        // 事件服务不可用时保持前端默认状态，不打断主流程
      }
    };

    pullStepStates();
    const timer = window.setInterval(pullStepStates, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
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
  const focusOccurrenceKey = `${focusOcc.start.toISOString()}-${focusOcc.baseIndex}`;

  useEffect(() => {
    const previous = previousFocusOccurrenceRef.current;
    if (!previous) {
      previousFocusOccurrenceRef.current = {
        key: focusOccurrenceKey,
        baseIndex: focusOcc.baseIndex,
      };
      return;
    }
    if (previous.key === focusOccurrenceKey) return;

    const previousTask = DAILY_TASKS[previous.baseIndex];
    const previousStepIds = getExternalStepIds(previousTask, previous.baseIndex);
    if (previousStepIds.length > 0) {
      const clearedAt = new Date().toISOString();
      previousStepIds.forEach((stepId) => {
        clearedStepAtRef.current[stepId] = clearedAt;
      });
      setExternalStepStateMap((currentMap) => {
        const nextMap = { ...currentMap };
        previousStepIds.forEach((stepId) => {
          delete nextMap[stepId];
        });
        return nextMap;
      });
    }

    previousFocusOccurrenceRef.current = {
      key: focusOccurrenceKey,
      baseIndex: focusOcc.baseIndex,
    };
  }, [focusOcc.baseIndex, focusOccurrenceKey]);

  const focusTaskSteps = useMemo(() => {
    if (!focusTask) return [];
    const autoStatus = timeline.isCompleted ? "success" : timeline.isArrived ? "running" : "pending";
    return normalizeTaskSteps(focusTask, focusOcc.baseIndex).map((step) => {
      const runtime = externalStepStateMap[step.id];
      const status = step.controlMode === "external"
        ? normalizeExternalStatus(runtime?.status)
        : autoStatus;
      return {
        ...step,
        status,
        message: runtime?.message || "",
      };
    });
  }, [externalStepStateMap, focusOcc.baseIndex, focusTask, timeline.isArrived, timeline.isCompleted]);
  const focusTaskSummary = useMemo(() => {
    const statuses = focusTaskSteps.map((step) => step.status);
    if (statuses.includes("error")) return "任务存在异常，请关注并处理。";
    if (focusTaskSteps.length > 0 && statuses.every((status) => status === "success")) return "任务步骤已完成。";
    if (statuses.includes("running")) return "任务执行中。";
    return "任务等待外部事件或时间驱动更新。";
  }, [focusTaskSteps]);

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
          {focusTaskSteps.length ? (
            <ul className="mt-3 space-y-2 text-slate-700">
              {focusTaskSteps.map((step, idx) => (
                <li key={`${focusTask.time}-${idx}`} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="leading-relaxed">{step.text}</p>
                    {step.controlMode === "external" ? (
                      <>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 font-medium ${STEP_STATUS_CLASSNAMES[step.status] || STEP_STATUS_CLASSNAMES.pending}`}
                          >
                            {STEP_STATUS_LABELS[step.status] || STEP_STATUS_LABELS.pending}
                          </span>
                        </div>
                        {step.message ? <p className="mt-1 text-xs text-slate-500">{step.message}</p> : null}
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
              已到达该节点，距离下一任务还有 <span className="font-semibold">{formatDuration(timeline.minutesToMove)}</span>。
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-700">
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
              <p className="text-xs text-slate-500">SRCB智能运维系统</p>
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
