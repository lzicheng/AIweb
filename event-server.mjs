import http from "node:http";

const PORT = 8787;
const HOST = "0.0.0.0";

const EXTERNAL_STEP_IDS = new Set(["1", "2", "3", "4", "5", "6", "7", "8"]);
const stepStates = new Map();
const eventIds = new Set();

const STATUS_BY_ACTION = {
  start: "running",
  success: "success",
  error: "error",
};

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
};

const getIsoNow = () => new Date().toISOString();

const server = http.createServer(async (req, res) => {
  if (!req.url) return json(res, 400, { error: "invalid_request" });
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/ops-events/health") {
    return json(res, 200, { ok: true, now: getIsoNow(), states: stepStates.size });
  }

  if (req.method === "GET" && url.pathname === "/ops-events/step-states") {
    const states = Array.from(stepStates.entries()).map(([stepId, value]) => ({
      stepId,
      ...value,
    }));
    return json(res, 200, { states });
  }

  if (req.method === "POST" && url.pathname === "/ops-events/step-events") {
    try {
      const body = await readBody(req);
      const stepId = typeof body.stepId === "string" ? body.stepId.trim() : "";
      const action = typeof body.action === "string" ? body.action.trim() : "";
      const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";

      if (!stepId || !action) {
        return json(res, 400, { error: "stepId_and_action_required" });
      }
      if (!EXTERNAL_STEP_IDS.has(stepId)) {
        return json(res, 403, { error: "step_not_allowed", stepId });
      }

      const status = STATUS_BY_ACTION[action];
      if (!status) {
        return json(res, 400, { error: "action_must_be_start_success_or_error" });
      }

      if (eventId) {
        if (eventIds.has(eventId)) {
          return json(res, 200, { ok: true, duplicated: true, stepId });
        }
        eventIds.add(eventId);
      }

      const message = typeof body.message === "string" ? body.message.trim() : "";
      const updatedAt = typeof body.timestamp === "string" && body.timestamp.trim() ? body.timestamp : getIsoNow();

      const previous = stepStates.get(stepId);
      if (previous?.updatedAt && updatedAt < previous.updatedAt) {
        return json(res, 200, { ok: true, ignored: "out_of_order", stepId });
      }

      stepStates.set(stepId, { status, message, updatedAt, action });
      return json(res, 200, { ok: true, stepId, status, updatedAt });
    } catch {
      return json(res, 400, { error: "invalid_json_body" });
    }
  }

  return json(res, 404, { error: "not_found", path: url.pathname });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[ops-events] listening on http://localhost:${PORT}`);
});
