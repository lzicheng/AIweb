import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { APP_TABS } from "./appTabs";

export default function App() {
  const [activeTabId, setActiveTabId] = useState(APP_TABS[0].id);

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
              <p className="text-xs text-slate-500">SRCB智能运营系统</p>
            </div>
          </div>

          <nav className="space-y-2">
            {APP_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTabId;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-lg"
                      : "bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="h-full min-h-0 min-w-0 rounded-[24px] border border-white/40 bg-white/30 p-3 backdrop-blur-xl">
          {APP_TABS.map((tab) => {
            const isActive = tab.id === activeTabId;
            const TabComponent = tab.component;

            return (
              <motion.div
                key={tab.id}
                initial={false}
                animate={{
                  opacity: isActive ? 1 : 0,
                  y: isActive ? 0 : 10,
                }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="h-full min-h-0"
                style={{
                  position: isActive ? "relative" : "absolute",
                  inset: isActive ? undefined : 0,
                  pointerEvents: isActive ? "auto" : "none",
                  visibility: isActive ? "visible" : "hidden",
                }}
              >
                <TabComponent />
              </motion.div>
            );
          })}
        </main>
      </div>
    </div>
  );
}