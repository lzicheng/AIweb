import { describe, expect, test } from "vitest";
import { buildFocusTaskSteps, summarizeFocusTaskSteps } from "./timelineStepState";

describe("timelineStepState", () => {
  test("id 为空的步骤不生成状态字段", () => {
    const steps = buildFocusTaskSteps({
      externalStepStateMap: {},
      isArrived: true,
      isCompleted: true,
      task: {
        steps: [{ id: "", text: "普通步骤" }],
      },
      taskIndex: 0,
    });

    expect(steps).toEqual([{ id: "", text: "普通步骤" }]);
  });

  test("只汇总有 id 的步骤状态", () => {
    expect(
      summarizeFocusTaskSteps([
        { id: "", text: "普通步骤" },
        { id: "db_check", status: "success", text: "数据库巡检" },
      ]),
    ).toBe("任务步骤已完成。");

    expect(summarizeFocusTaskSteps([{ id: "", text: "普通步骤" }])).toBe(
      "任务等待外部事件或时间驱动更新。",
    );
  });
});
