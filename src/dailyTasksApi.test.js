import { describe, expect, test, vi } from "vitest";
import { fetchDailyTasks } from "./dailyTasksApi";

const fallbackTasks = [
  {
    time: "08:00",
    title: "默认任务",
    steps: [{ id: "", text: "默认步骤" }],
  },
];

describe("dailyTasksApi", () => {
  test("从运行期配置地址拉取任务配置", async () => {
    const runtimeTasks = [
      {
        time: "09:30",
        title: "运行期任务",
        steps: [{ id: "db_check", text: "数据库巡检" }],
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tasks: runtimeTasks }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await expect(
      fetchDailyTasks({
        fallbackTasks,
        fetchImpl: fetchMock,
        tasksUrl: "/config/daily-tasks.json",
      }),
    ).resolves.toEqual(runtimeTasks);

    expect(fetchMock).toHaveBeenCalledWith("/config/daily-tasks.json", {
      headers: { accept: "application/json" },
    });
  });

  test("配置不可用或数据无效时回退默认任务", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tasks: [] }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await expect(
      fetchDailyTasks({
        fallbackTasks,
        fetchImpl: fetchMock,
        tasksUrl: "/config/daily-tasks.json",
      }),
    ).resolves.toEqual(fallbackTasks);
  });
});
