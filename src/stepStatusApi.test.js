import { describe, expect, test, vi } from "vitest";
import { fetchStepStatusMap } from "./stepStatusApi";

describe("stepStatusApi", () => {
  test("按 stepIds 查询最近状态并按 stepId 建立映射", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          states: [
            {
              insertedAt: "2026-05-13 15:01:20",
              message: "后置一体机数据库巡检完成",
              source: "sdata-check-job",
              status: "success",
              stepId: "sdata_db_check",
            },
          ],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      ),
    );

    const result = await fetchStepStatusMap({
      apiUrl: "/api/step-status",
      fetchImpl: fetchMock,
      stepIds: ["sdata_db_check", "ads_flow_check"],
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/step-status?stepIds=sdata_db_check%2Cads_flow_check", {
      headers: { accept: "application/json" },
    });
    expect(result).toEqual({
      sdata_db_check: {
        insertedAt: "2026-05-13 15:01:20",
        message: "后置一体机数据库巡检完成",
        source: "sdata-check-job",
        status: "success",
        stepId: "sdata_db_check",
      },
    });
  });

  test("保留数据库返回的 status 字段值", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          states: [
            {
              insertedAt: "2026-05-13 15:01:20",
              status: "done_by_database",
              stepId: "db_check",
            },
          ],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      ),
    );

    const result = await fetchStepStatusMap({
      apiUrl: "/api/step-status",
      fetchImpl: fetchMock,
      stepIds: ["db_check"],
    });

    expect(result.db_check.status).toBe("done_by_database");
  });

  test("没有外部步骤时不发起请求", async () => {
    const fetchMock = vi.fn();

    await expect(
      fetchStepStatusMap({
        apiUrl: "/api/step-status",
        fetchImpl: fetchMock,
        stepIds: [],
      }),
    ).resolves.toEqual({});

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("支持完整 URL 的状态服务地址", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ states: [] }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await fetchStepStatusMap({
      apiUrl: "http://127.0.0.1:8000/api/step-status",
      fetchImpl: fetchMock,
      stepIds: ["sdata_db_check"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/step-status?stepIds=sdata_db_check",
      {
        headers: { accept: "application/json" },
      },
    );
  });
});
