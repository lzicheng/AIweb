import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useDailyTasks } from "./useDailyTasks";

describe("useDailyTasks", () => {
  test("先返回默认任务，再切换到运行期任务", async () => {
    const fallbackTasks = [{ time: "08:00", title: "默认任务", steps: ["默认步骤"] }];
    const runtimeTasks = [{ time: "09:00", title: "运行期任务", steps: ["运行期步骤"] }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tasks: runtimeTasks }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    const { result } = renderHook(() =>
      useDailyTasks({
        fallbackTasks,
        fetchImpl: fetchMock,
        refreshMs: 0,
        tasksUrl: "/config/daily-tasks.json",
      }),
    );

    expect(result.current.tasks).toEqual(fallbackTasks);

    await waitFor(() => {
      expect(result.current.tasks).toEqual(runtimeTasks);
    });
  });
});
