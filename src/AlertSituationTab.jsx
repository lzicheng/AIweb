import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldAlert } from "lucide-react";
import { APP_CONFIG } from "./appConfig";

const PAGE_SIZE = 20;

const EMPTY_DASHBOARD = {
  total_alerts: 0,
  converged_alerts: 0,
  convergence_rate: 0,
  high_level: {},
  by_source: [],
  by_level: [],
  by_entity: [],
};

function formatLocalDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizeDateTimeInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const normalized = text.replace("T", " ");
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function levelClass(level) {
  const value = String(level || "").toUpperCase();
  if (value === "P1") return "level-p1";
  if (value === "P2") return "level-p2";
  return "level-normal";
}

async function publicApi(path, signal) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      search.set(key, value);
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

function StatCard({ label, value }) {
  return (
    <article className="display-stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </article>
  );
}

function HighLevelOverview({ highLevel }) {
  const latest = highLevel?.latest;
  const latestText = latest
    ? `${latest.final_level || latest.level || ""} · ${latest.source || "未知来源"} · ${latest.occur_time || ""}`
    : "暂无高等级告警";
  const latestContent = latest ? (latest.normalized_content || latest.content || "").slice(0, 90) : "";

  return (
    <section className="display-high-grid">
      <article className="display-high-card">
        <div className="label">当前 P1/P2 数量</div>
        <div className="value">{Number(highLevel?.current_count || 0)}</div>
      </article>
      <article className="display-high-card">
        <div className="label">最近 1 小时新增 P1/P2</div>
        <div className="value">{Number(highLevel?.last_hour_count || 0)}</div>
      </article>
      <article className="display-high-card latest-high-card">
        <div className="label">最近一条 P1/P2 告警</div>
        <strong>{latestText}</strong>
        <p>{latestContent || "-"}</p>
      </article>
    </section>
  );
}

function RankList({ rows, type }) {
  const max = Math.max(1, ...rows.map((item) => Number(item.count || 0)));
  if (!rows.length) return <div className="mock-empty">暂无统计数据。</div>;

  return rows.map((item, index) => {
    const name = type === "entity" ? item.entity || "未知实体" : item.source || "未知来源";
    const width = Math.round((Number(item.count || 0) / max) * 100);
    return (
      <div className="display-rank-item" key={`${name}-${index}`}>
        <div className="display-rank-head">
          <strong>
            {name}
            {type === "entity" && item.type ? <span>{item.type}</span> : null}
          </strong>
          <b>{Number(item.count || 0)}</b>
        </div>
        <div className="display-rank-bar">
          <i style={{ width: `${width}%` }} />
        </div>
      </div>
    );
  });
}

function LevelDistribution({ rows }) {
  const max = Math.max(1, ...rows.map((item) => Number(item.count || 0)));
  if (!rows.length) return <div className="mock-empty">暂无统计数据。</div>;

  return rows.map((item, index) => {
    const level = item.level || "P3";
    const width = Math.round((Number(item.count || 0) / max) * 100);
    const className = levelClass(level);
    return (
      <div className="display-rank-item" key={`${level}-${index}`}>
        <div className="display-rank-head">
          <strong>
            <span className={`level-pill ${className}`}>{level}</span>
          </strong>
          <b>{Number(item.count || 0)}</b>
        </div>
        <div className="display-rank-bar">
          <i className={className} style={{ width: `${width}%` }} />
        </div>
      </div>
    );
  });
}

function AlertCard({ item }) {
  const level = item.final_level || item.level || "P3";
  const isHighLevel = ["P1", "P2"].includes(String(level).toUpperCase());
  const content = item.normalized_content || item.content || "";

  return (
    <article className={`display-alert ${isHighLevel ? "is-high-level" : ""}`}>
      <div className="display-alert-main">
        <span className={`level-pill ${levelClass(level)}`}>{level}</span>
        <div>
          <h3>{item.normalized_title || item.title || item.source || "未命名告警"}</h3>
          <div className="display-alert-meta">
            <span>{item.source || "未知来源"}</span>
            <span>{item.category || "未分类"}</span>
            <span>{item.occur_time || ""}</span>
          </div>
        </div>
      </div>
      <p>{content.slice(0, 220)}</p>
      <div className="display-alert-foot">
        <span>动作: {item.action || "-"}</span>
        <span>发送: {item.send_status || "-"}</span>
        <span>实体: {item.affected_entity || "-"}</span>
      </div>
    </article>
  );
}

export default function AlertSituationTab() {
  const [clock, setClock] = useState(() => formatLocalDateTime(new Date()));
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState("");
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [alerts, setAlerts] = useState({ items: [], page: 1, page_size: PAGE_SIZE, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statsFilters, setStatsFilters] = useState({ startTime: "", endTime: "" });
  const [filters, setFilters] = useState({
    search: "",
    startTime: "",
    endTime: "",
    source: "",
    level: "",
    action: "",
  });
  const [draftStatsFilters, setDraftStatsFilters] = useState(statsFilters);
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatLocalDateTime(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const received = Number(dashboard.total_alerts || 0);
    const converged = Number(dashboard.converged_alerts || 0);
    const rate = `${Math.round(Number(dashboard.convergence_rate || 0) * 100)}%`;
    return [
      ["告警接收数量", received],
      ["收敛数量", converged],
      ["收敛率", rate],
    ];
  }, [dashboard]);

  const loadDisplayStats = useCallback(
    async (signal) => {
      const suffix = buildQuery({
        start_time: statsFilters.startTime,
        end_time: statsFilters.endTime,
      });
      return publicApi(`${APP_CONFIG.alertSituation.dashboardUrl}${suffix}`, signal);
    },
    [statsFilters.endTime, statsFilters.startTime],
  );

  const loadDisplayAlerts = useCallback(
    async (signal) => {
      const suffix = buildQuery({
        page,
        page_size: PAGE_SIZE,
        q: filters.search,
        start_time: filters.startTime,
        end_time: filters.endTime,
        source: filters.source,
        level: filters.level,
        action: filters.action,
      });
      return publicApi(`${APP_CONFIG.alertSituation.alertsUrl}${suffix}`, signal);
    },
    [filters, page],
  );

  const refreshDisplay = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    try {
      const [nextDashboard, nextAlerts] = await Promise.all([
        loadDisplayStats(controller.signal),
        loadDisplayAlerts(controller.signal),
      ]);
      setDashboard(nextDashboard || EMPTY_DASHBOARD);
      setAlerts(nextAlerts || { items: [], page, page_size: PAGE_SIZE, total: 0 });
      setLastRefresh(formatLocalDateTime(new Date()));
    } catch (nextError) {
      if (nextError?.name !== "AbortError") {
        setError(nextError instanceof Error ? nextError.message : "告警态势接口请求失败");
      }
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [loadDisplayAlerts, loadDisplayStats, page]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([loadDisplayStats(controller.signal), loadDisplayAlerts(controller.signal)])
      .then(([nextDashboard, nextAlerts]) => {
        setDashboard(nextDashboard || EMPTY_DASHBOARD);
        setAlerts(nextAlerts || { items: [], page, page_size: PAGE_SIZE, total: 0 });
        setLastRefresh(formatLocalDateTime(new Date()));
      })
      .catch((nextError) => {
        if (nextError?.name !== "AbortError") {
          setError(nextError instanceof Error ? nextError.message : "告警态势接口请求失败");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [loadDisplayAlerts, loadDisplayStats, page]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      refreshDisplay();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refreshDisplay]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: draftFilters.search.trim() }));
      setPage(1);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [draftFilters.search]);

  const totalPages = Math.max(1, Math.ceil(Number(alerts.total || 0) / Number(alerts.page_size || PAGE_SIZE)));

  const applyStatsFilters = () => {
    setStatsFilters({
      startTime: normalizeDateTimeInput(draftStatsFilters.startTime),
      endTime: normalizeDateTimeInput(draftStatsFilters.endTime),
    });
  };

  const resetStatsFilters = () => {
    setDraftStatsFilters({ startTime: "", endTime: "" });
    setStatsFilters({ startTime: "", endTime: "" });
  };

  const applyFilters = () => {
    setFilters({
      search: draftFilters.search.trim(),
      startTime: normalizeDateTimeInput(draftFilters.startTime),
      endTime: normalizeDateTimeInput(draftFilters.endTime),
      source: draftFilters.source.trim(),
      level: draftFilters.level,
      action: draftFilters.action,
    });
    setPage(1);
  };

  const resetFilters = () => {
    const empty = {
      search: "",
      startTime: "",
      endTime: "",
      source: "",
      level: "",
      action: "",
    };
    setDraftFilters(empty);
    setFilters(empty);
    setPage(1);
  };

  return (
    <section className="alert-situation h-full min-h-0 overflow-y-auto rounded-[30px]">
      <div className="display-workspace">
        <header className="display-hero">
          <div>
            <div className="display-title-row">
              <h1>告警态势展示</h1>
              <span className="display-badge">Live Monitor</span>
            </div>
            <p className="subtitle">对接运营控制台的只读态势页，展示告警接收、收敛、高等级风险与关键实体。</p>
          </div>
          <div className="display-status">
            <div className="display-clock">{clock}</div>
            <div className="display-refresh-row">
              <label className="display-auto-refresh">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                />
                自动刷新
              </label>
              <span>{autoRefresh ? "自动刷新中" : "自动刷新已暂停"}</span>
            </div>
            <div className="display-last-refresh">最后刷新: {lastRefresh || "--"}</div>
          </div>
        </header>

        <div className="display-task-banner">
          <span>当前视图：告警接收与收敛态势</span>
          <button className="ghost-btn icon-btn" type="button" onClick={refreshDisplay} disabled={loading}>
            <RefreshCw size={16} />
            刷新
          </button>
        </div>

        {error ? (
          <div className="display-error">
            <ShieldAlert size={16} />
            <span>接口暂不可用：{error}。请确认 Alert Converger 后端已启动并监听 8080 端口。</span>
          </div>
        ) : null}

        <section className="display-stats">
          {stats.map(([label, value]) => (
            <StatCard key={label} label={label} value={value} />
          ))}
        </section>
        <HighLevelOverview highLevel={dashboard.high_level || {}} />

        <section className="panel display-monitor display-section-panel">
          <div className="display-toolbar">
            <div>
              <span className="section-kicker">Statistics</span>
              <h2>统计分析</h2>
            </div>
          </div>
          <div className="display-filter-grid display-stat-filter-grid">
            <label>
              开始时间
              <input
                type="datetime-local"
                value={draftStatsFilters.startTime}
                onChange={(event) =>
                  setDraftStatsFilters((current) => ({ ...current, startTime: event.target.value }))
                }
              />
            </label>
            <label>
              结束时间
              <input
                type="datetime-local"
                value={draftStatsFilters.endTime}
                onChange={(event) =>
                  setDraftStatsFilters((current) => ({ ...current, endTime: event.target.value }))
                }
              />
            </label>
            <div className="display-filter-actions">
              <button className="full-width-btn" type="button" onClick={applyStatsFilters}>
                统计
              </button>
              <button className="ghost-btn" type="button" onClick={resetStatsFilters}>
                重置
              </button>
            </div>
          </div>
          <div className="display-insights-grid">
            <section className="display-insight">
              <h3>告警来源 Top 5</h3>
              <div className="display-rank-list">
                <RankList rows={dashboard.by_source || []} type="source" />
              </div>
            </section>
            <section className="display-insight">
              <h3>告警等级分布</h3>
              <div className="display-rank-list">
                <LevelDistribution rows={dashboard.by_level || []} />
              </div>
            </section>
            <section className="display-insight">
              <h3>影响实体 Top 5</h3>
              <div className="display-rank-list">
                <RankList rows={dashboard.by_entity || []} type="entity" />
              </div>
            </section>
          </div>
        </section>

        <section className="panel display-monitor display-section-panel">
          <div className="display-toolbar">
            <div>
              <span className="section-kicker">Recent Alerts</span>
              <h2>最近接收的告警</h2>
            </div>
          </div>
          <div className="display-filter-grid">
            <label>
              开始时间
              <input
                type="datetime-local"
                value={draftFilters.startTime}
                onChange={(event) => setDraftFilters((current) => ({ ...current, startTime: event.target.value }))}
              />
            </label>
            <label>
              结束时间
              <input
                type="datetime-local"
                value={draftFilters.endTime}
                onChange={(event) => setDraftFilters((current) => ({ ...current, endTime: event.target.value }))}
              />
            </label>
            <label>
              来源群
              <input
                placeholder="生产告警群"
                value={draftFilters.source}
                onChange={(event) => setDraftFilters((current) => ({ ...current, source: event.target.value }))}
              />
            </label>
            <label>
              告警等级
              <select
                value={draftFilters.level}
                onChange={(event) => {
                  setDraftFilters((current) => ({ ...current, level: event.target.value }));
                  setFilters((current) => ({ ...current, level: event.target.value }));
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value="P4">P4</option>
              </select>
            </label>
            <label>
              动作
              <select
                value={draftFilters.action}
                onChange={(event) => {
                  setDraftFilters((current) => ({ ...current, action: event.target.value }));
                  setFilters((current) => ({ ...current, action: event.target.value }));
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                <option value="forward">forward</option>
                <option value="ignore">ignore</option>
                <option value="escalate">escalate</option>
                <option value="merge">merge</option>
                <option value="route">route</option>
              </select>
            </label>
            <label>
              搜索
              <span className="input-with-icon">
                <Search size={15} />
                <input
                  placeholder="内容、分类、实体、等级"
                  value={draftFilters.search}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </span>
            </label>
            <div className="display-filter-actions">
              <button className="full-width-btn" type="button" onClick={applyFilters}>
                筛选
              </button>
              <button className="ghost-btn" type="button" onClick={resetFilters}>
                重置
              </button>
            </div>
          </div>
          <div className="display-alert-list">
            {alerts.items?.length ? (
              alerts.items.map((item, index) => <AlertCard key={item.id || `${item.source}-${index}`} item={item} />)
            ) : (
              <div className="mock-empty">暂无告警。</div>
            )}
          </div>
          <div className="pager">
            <button className="ghost-btn pager-btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              上一页
            </button>
            <span>
              第 {page} / {totalPages} 页，共 {Number(alerts.total || 0)} 条
            </span>
            <button
              className="ghost-btn pager-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              下一页
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
