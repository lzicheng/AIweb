import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquareText, SendHorizontal, Sparkles } from "lucide-react";
import { createSessionId, runOpsAssistant } from "./opsAssistantApi";

const INITIAL_MESSAGES = [
  { role: "assistant", content: "你好，我是运营助手。你可以直接输入问题，我会通过后端 API 返回结果。" },
];

export default function ChatTab() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => createSessionId());

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
    const element = scrollRef.current;
    if (!element || !isNearBottomRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    isNearBottomRef.current = true;
  }, [sessionId]);

  useEffect(
    () => () => {
      abortRef.current?.abort?.();
    },
    [],
  );

  const startNewChat = () => {
    abortRef.current?.abort?.();
    setLoading(false);
    setInput("");
    setMessages([
      {
        role: "assistant",
        content: "已开始新对话。请继续输入你的问题，我会通过后端 API 返回结果。",
      },
    ]);
    setSessionId(createSessionId());
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((current) => [...current, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      abortRef.current?.abort?.();
      const controller = new AbortController();
      abortRef.current = controller;
      const sessionAtSend = sessionId;

      const assistantText = await runOpsAssistant({
        message: text,
        sessionId: sessionAtSend,
        signal: controller.signal,
      });

      if (sessionAtSend !== activeSessionRef.current) return;
      setMessages((current) => [...current, { role: "assistant", content: assistantText }]);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setMessages((current) => [
        ...current,
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
          <h2 className="text-3xl font-semibold text-slate-900">运营助手</h2>
          <p className="mt-1 text-sm text-slate-500">深圳农商银行运营助手</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={startNewChat}
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
          const element = scrollRef.current;
          if (!element) return;
          const threshold = 64;
          const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
          isNearBottomRef.current = distance <= threshold;
        }}
        className="chat-scroll min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-5"
      >
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" ? (
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                <Bot size={16} />
              </div>
            ) : null}

            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
                message.role === "user"
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-800"
              }`}
            >
              {message.content}
            </div>

            {message.role === "user" ? (
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
