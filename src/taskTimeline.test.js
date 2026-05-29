import { describe, expect, test } from "vitest";
import { getExternalStepIds, normalizeTaskSteps } from "./taskTimeline";

describe("taskTimeline step normalization", () => {
  const task = {
    time: "09:00",
    steps: [
      "自动步骤",
      { id: "db_check", text: "数据库巡检" },
      { id: "", text: "无外部状态步骤" },
    ],
  };

  test("只有显式配置非空 id 的步骤走查询模式", () => {
    expect(normalizeTaskSteps(task, 0)).toEqual([
      {
        id: "",
        text: "自动步骤",
      },
      {
        id: "db_check",
        text: "数据库巡检",
      },
      {
        id: "",
        text: "无外部状态步骤",
      },
    ]);
  });

  test("外部状态查询只收集非空 id", () => {
    expect(getExternalStepIds(task, 0)).toEqual(["db_check"]);
  });
});
