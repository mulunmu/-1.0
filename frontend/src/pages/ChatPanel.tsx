import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Markdown from "react-markdown";
import {
  Send,
  User,
  BarChart3,
  GitCompare,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Download,
  MessageSquare,
  ChevronRight,
  Clock,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ChatInlineChart from "@/components/ChatInlineChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskCard, RiskCardContent } from "@/components/ui/RiskCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBlock } from "@/components/StateViews";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { getInstantRiskWarnings, sendChatMessage } from "@/lib/dataSource";
import {
  getRiskWarnings,
  type ChatResponse,
  type RiskWarningItem,
} from "@/lib/api";
import { RISK_LEVEL_COLORS } from "@/lib/labels";
import { SEED_ENTERPRISE_A, SEED_ENTERPRISE_B, QUICK_COMPARE_QUERY, QUICK_ANALYZE_QUERY, QUICK_WARNINGS_QUERY, QUICK_RANKING_QUERY } from "@/lib/constants";
import { cn } from "@/lib/utils";

/* ──────────────── 类型 ──────────────── */

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

/* ──────────────── 常量 ──────────────── */

const QUICK_ACTIONS: { label: string; query: string; Icon: LucideIcon }[] = [
  { label: "风险预警", query: QUICK_WARNINGS_QUERY, Icon: AlertTriangle },
  { label: "企业对比", query: QUICK_COMPARE_QUERY, Icon: GitCompare },
  { label: "行业排名", query: QUICK_RANKING_QUERY, Icon: BarChart3 },
  { label: "税务健康", query: QUICK_ANALYZE_QUERY, Icon: ShieldCheck },
];

const PROMPTS: { label: string; query: string }[] = [
  { label: "预警扫描", query: QUICK_WARNINGS_QUERY },
  { label: "企业对比", query: QUICK_COMPARE_QUERY },
  { label: "行业排名", query: QUICK_RANKING_QUERY },
  { label: "深度分析", query: QUICK_ANALYZE_QUERY },
];

const DIMENSIONS = ["财务", "合规", "舆情", "交易", "关联"];

const BOILERPLATE_REPLY = "暂无文字回复，请查看下方图表与数据详情。";

function shouldShowText(content: string, hasChart: boolean): boolean {
  if (!content.trim()) return false;
  if (
    hasChart &&
    (content === BOILERPLATE_REPLY || content.length < 30)
  )
    return false;
  return true;
}

/* ──────────────── 流式加载骨架 ──────────────── */

function StreamingSkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <div className="shrink-0 pt-1">
        <div className="w-7 h-7 rounded-md bg-white/[0.06] border border-white/[0.08] flex items-center justify-center animate-pulse">
          <span className="text-[9px] font-bold text-neutral-500">AI</span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 min-w-0">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-[85%] rounded" />
        <Skeleton className="h-3 w-[60%] rounded" />
        <Skeleton className="h-3 w-[72%] rounded" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════ */

export default function ChatPanel() {
  const [searchParams] = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<RiskWarningItem[]>(() => getInstantRiskWarnings());
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const { toast, showToast, closeToast } = useToast();

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialSentRef = useRef(false);
  const initialQuery = searchParams.get("q");

  /* ── 预警数据 ── */

  useEffect(() => {
    getRiskWarnings()
      .then(setWarnings)
      .catch(() => setWarnings([]));
  }, []);

  /* ── 发送消息 ── */

  const handleSend = useCallback(
    async (text?: string) => {
      const query = (text ?? input).trim();
      if (!query || loading) return;

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: query },
      ]);
      setInput("");
      setLoading(true);

      try {
        const res = await sendChatMessage(query, sessionId);
        // 同步后端返回的 session_id 用于多轮对话
        if (res.session_id && res.session_id !== sessionId) {
          setSessionId(res.session_id);
        }
        const replyText = res.reply?.trim() || BOILERPLATE_REPLY;
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: replyText,
            response: res,
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              e instanceof Error
                ? e.message
                : "请求失败，请检查后端服务是否运行。",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, sessionId],
  );

  /* ── 初始查询自动发送 ── */

  useEffect(() => {
    if (!initialQuery || initialSentRef.current) return;
    if (messages.length > 0) return;
    initialSentRef.current = true;
    void handleSend(initialQuery);
  }, [initialQuery, messages.length, handleSend]);

  /* ── 自动滚动 ── */

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  /* ── 输入框自适应高度 ── */

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  /* ── 清空对话 ── */

  function handleClear() {
    if (messages.length > 0) {
      const title =
        messages.find((m) => m.role === "user")?.content.slice(0, 30) ??
        "对话记录";
      setSessions((prev) => [
        {
          id: sessionId,
          title,
          messages: [...messages],
          createdAt: Date.now(),
        },
        ...prev.slice(0, 19),
      ]);
    }
    setMessages([]);
    setSessionId(crypto.randomUUID());
    initialSentRef.current = true;
    setInput("");
    showToast("对话已清空", "info");
  }

  /* ── 切换历史对话 ── */

  function handleSwitchSession(s: ChatSession) {
    /* 先保存当前对话 */
    if (messages.length > 0) {
      const title =
        messages.find((m) => m.role === "user")?.content.slice(0, 30) ??
        "对话记录";
      setSessions((prev) =>
        [
          { id: sessionId, title, messages: [...messages], createdAt: Date.now() },
          ...prev.filter((x) => x.id !== s.id),
        ].slice(0, 20),
      );
    } else {
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    }
    setMessages(s.messages);
    setSessionId(s.id);
    initialSentRef.current = true;
  }

  function handleDeleteSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    showToast("已删除历史对话", "info");
  }

  /* ── 键盘事件 ── */

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  /* ── 派生状态 ── */

  const isEmpty = messages.length === 0 && !loading;
  const hasInput = input.trim().length > 0;

  /* ── 从消息中提取上下文企业信息 ── */
  const contextEnterprise = (() => {
    for (const msg of messages) {
      if (msg.role === "assistant" && msg.response?.data) {
        const d = msg.response.data as Record<string, unknown>;
        if (d.enterprise_name) {
          return {
            name: String(d.enterprise_name),
            score: Number(d.overall_score ?? 0),
            risk: String(d.risk_level ?? "中等风险"),
          };
        }
      }
    }
    return null;
  })();

  /* ══════════════════════════════════════
     渲染
     ══════════════════════════════════════ */

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* ═══ 顶部控制栏 ═══ */}
      <header data-reveal className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/[0.06] shrink-0 bg-[var(--color-bg-deep)]">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={16} className="text-neutral-500 shrink-0" />
          <div>
            <span className="text-sm font-medium text-neutral-200 block leading-tight">
              研判会话
              <span className="text-neutral-600 font-mono text-[10px] ml-2">
                {sessionId.slice(0, 8)}
              </span>
            </span>
            <span className="text-[10px] text-neutral-600 hidden sm:block">
              审计留痕 · 风险分析
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-7 border-white/[0.1] text-[10px] gap-1.5 hover:bg-white/[0.06] hover:border-white/[0.18] active:bg-white/[0.1] transition-colors duration-200 ease-out"
            >
              <RotateCcw size={12} />
              清空对话
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const text = messages
                .map((m) => `[${m.role === "user" ? "用户" : "AI"}] ${m.content}`)
                .join("\n\n---\n\n");
              const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `chat-${sessionId.slice(0, 8)}.txt`;
              a.click();
              URL.revokeObjectURL(url);
              showToast("会话记录已导出", "success");
            }}
            className="h-7 border-white/[0.1] text-[10px] gap-1.5 hover:bg-white/[0.06] hover:border-white/[0.18] active:bg-white/[0.1] transition-colors duration-200 ease-out"
          >
            <Download size={12} />
            导出记录
          </Button>
        </div>
      </header>

      {/* ═══ 主体双栏 ═══ */}
      <div data-reveal className="flex-1 flex min-h-0">
        {/* ── 左栏 flex-[4]：对话主容器 ── */}
        <div className="flex-[4] min-w-0 flex flex-col min-h-0">
          {/* 消息滚动区 */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            {/* 空状态 */}
            {isEmpty && (
              <div className="flex flex-col items-center justify-center min-h-full py-8">
                <div className="text-center max-w-md mb-8">
                  <div className="w-10 h-10 mx-auto mb-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-bg-surface)] flex items-center justify-center opacity-60">
                    <span className="text-sm font-bold font-mono text-neutral-400">AI</span>
                  </div>
                  <h2 className="text-xl font-semibold text-neutral-100 mb-2">
                    向风控引擎提问
                  </h2>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    企业查询、风险对比、预警扫描与行业排名。
                    <br />
                    从工作台跳转将自动执行。
                  </p>
                </div>

                <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-3 self-start max-w-md w-full">
                  快速开始
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                  {PROMPTS.map(({ label, query }) => (
                    <button
                      key={query}
                      type="button"
                      onClick={() => void handleSend(query)}
                      disabled={loading}
                      className={cn(
                        "rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-left",
                        "hover:bg-white/[0.05] hover:border-white/[0.14]",
                        "active:bg-white/[0.07]",
                        "transition-colors duration-200",
                        "disabled:opacity-50",
                      )}
                    >
                      <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">
                        {label}
                      </p>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {query}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 消息列表 */}
            {!isEmpty && (
              <div className="max-w-3xl mx-auto space-y-4 pb-2">
                {messages.map((msg, i) => {
                  const hasChart = Boolean(msg.response?.charts);
                  const showText =
                    msg.role === "assistant"
                      ? shouldShowText(msg.content, hasChart)
                      : true;

                  /* 用户消息 — 右对齐 */
                  if (msg.role === "user") {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div
                          className={cn(
                            "group inline-flex items-start gap-2 max-w-[85%]",
                            "rounded-lg border px-4 py-2.5",
                            "bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] border-[color-mix(in_srgb,var(--color-primary)_18%,transparent)]",
                            "hover:border-[color-mix(in_srgb,var(--color-primary)_28%,transparent)] transition-colors duration-200 ease-out",
                          )}
                        >
                          <User className="h-3.5 w-3.5 text-blue-400/70 shrink-0 mt-0.5" />
                          <span className="text-sm text-neutral-200 font-mono break-all leading-relaxed">
                            {msg.content}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  /* AI 消息 — 左对齐 */
                  return (
                    <div key={msg.id} className="flex gap-3 group">
                      <div className="shrink-0 pt-0.5">
                        <div className="w-7 h-7 rounded-md bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                          <span className="text-[9px] font-bold text-neutral-500">AI</span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex-1 min-w-0 rounded-lg border px-4 py-3",
                          "bg-[var(--color-bg-surface)] border-white/[0.06]",
                          "hover:border-white/[0.12] transition-colors duration-200 ease-out",
                        )}
                      >
                        {/* 内联图表 */}
                        {hasChart && msg.response?.charts && (
                          <div className="mb-3 -mx-1">
                            <ChatInlineChart charts={msg.response.charts} />
                          </div>
                        )}

                        {/* Markdown 文本 */}
                        {showText && (
                          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-neutral-100 text-neutral-300">
                            <Markdown>{msg.content}</Markdown>
                          </div>
                        )}

                        {/* 无文字内容 */}
                        {!showText && !hasChart && (
                          <p className="text-xs text-neutral-600 italic">
                            暂无文字回复
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 流式加载骨架 */}
                {loading && <StreamingSkeleton />}
              </div>
            )}

            {/* 报错兜底 */}
            {!isEmpty &&
              messages.length > 0 &&
              messages[messages.length - 1]?.role === "assistant" &&
              messages[messages.length - 1]?.content.includes("请求失败") && (
                <div className="max-w-3xl mx-auto mt-2">
                  <ErrorBlock
                    message={messages[messages.length - 1].content}
                  />
                </div>
              )}
          </div>

          {/* ── 底部输入栏 ── */}
          <div className="shrink-0 border-t border-white/[0.06] px-4 py-3 bg-[var(--color-bg-deep)]">
            <div className="max-w-3xl mx-auto">
              {/* 快捷提问 */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {QUICK_ACTIONS.map(({ label, query, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => void handleSend(query)}
                    disabled={loading}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1",
                      "text-[11px] text-neutral-400",
                      "border-white/[0.08] bg-white/[0.02]",
                      "hover:text-neutral-200 hover:bg-white/[0.06] hover:border-white/[0.14]",
                      "active:bg-white/[0.08]",
                      "transition-colors duration-200 ease-out",
                      "disabled:opacity-50",
                    )}
                  >
                    <Icon size={12} className="text-neutral-500" />
                    {label}
                  </button>
                ))}
              </div>

              {/* 输入框 */}
              <div
                className={cn(
                  "flex items-end gap-2 rounded-lg border px-3 py-2",
                  "bg-[var(--color-bg-surface)]",
                  hasInput
                    ? "border-white/[0.2]"
                    : "border-white/[0.08]",
                  "transition-colors duration-200 ease-out",
                )}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入分析问题，Enter 发送 · Shift+Enter 换行"
                  disabled={loading}
                  rows={1}
                  className="flex-1 min-w-0 resize-none border-none bg-transparent text-sm text-neutral-200 placeholder:text-neutral-600 outline-none leading-relaxed"
                  style={{ maxHeight: "120px" }}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={loading || !hasInput}
                  aria-label="发送"
                  className={cn(
                    "shrink-0 flex items-center justify-center w-8 h-8 rounded-md",
                    "transition-colors duration-200 ease-out",
                    hasInput
                      ? "bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700"
                      : "bg-white/[0.06] text-neutral-600 cursor-not-allowed",
                  )}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 右栏 w-80：上下文面板 ── */}
        <aside className="w-72 lg:w-80 shrink-0 border-l border-white/[0.06] overflow-y-auto p-4 space-y-3 hidden lg:block bg-[var(--color-bg-deep)]">
          {/* 当前研判企业快照 */}
          {contextEnterprise ? (
            <RiskCard>
              <RiskCardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-blue-400" />
                  <span className="text-xs font-medium text-neutral-400 tracking-wide">
                    研判企业
                  </span>
                </div>
                <h3 className="text-sm font-medium text-neutral-100 leading-snug">
                  {contextEnterprise.name}
                </h3>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-neutral-100 leading-none">
                    {contextEnterprise.score.toFixed(0)}
                  </span>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      RISK_LEVEL_COLORS[contextEnterprise.risk] ??
                        RISK_LEVEL_COLORS["中等风险"],
                    )}
                  >
                    {contextEnterprise.risk}
                  </Badge>
                </div>
              </RiskCardContent>
            </RiskCard>
          ) : (
            <RiskCard>
              <RiskCardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-neutral-500" />
                  <span className="text-xs font-medium text-neutral-400 tracking-wide">
                    研判上下文
                  </span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  发送企业分析请求后，此处将展示当前研判企业的风险快照。
                </p>
              </RiskCardContent>
            </RiskCard>
          )}

          {/* 快捷风控指令 */}
          <RiskCard>
            <RiskCardContent className="space-y-2.5">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-neutral-500" />
                <span className="text-xs font-medium text-neutral-400 tracking-wide">
                  快捷指令
                </span>
              </div>
              <div className="space-y-1">
                {QUICK_ACTIONS.map(({ label, query }) => (
                  <button
                    key={query}
                    type="button"
                    onClick={() => void handleSend(query)}
                    disabled={loading}
                    className={cn(
                      "w-full text-left rounded-md px-2.5 py-1.5 text-xs text-neutral-400",
                      "hover:bg-white/[0.05] hover:text-neutral-200",
                      "active:bg-white/[0.07]",
                      "transition-colors duration-200 ease-out",
                      "disabled:opacity-50",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </RiskCardContent>
          </RiskCard>

          {/* 活跃预警 */}
          <RiskCard>
            <RiskCardContent className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span className="text-xs font-medium text-neutral-400 tracking-wide">
                    活跃预警
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSend("有哪些风险预警")}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 flex items-center gap-0.5 transition-colors duration-200 ease-out"
                >
                  全部 <ChevronRight size={11} />
                </button>
              </div>
              {warnings.length === 0 ? (
                <p className="text-[11px] text-neutral-600 py-2 text-center">
                  暂无活跃预警
                </p>
              ) : (
                <div className="space-y-0.5">
                  {warnings.slice(0, 5).map((w) => (
                    <button
                      key={w.enterprise_id}
                      type="button"
                      onClick={() =>
                        void handleSend(`分析${w.enterprise_name}的风险`)
                      }
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left",
                        "hover:bg-white/[0.04] transition-colors duration-200 ease-out group",
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400/70 shrink-0" />
                      <span className="text-[11px] text-neutral-400 group-hover:text-neutral-200 truncate flex-1">
                        {w.enterprise_name}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-600 shrink-0">
                        {w.overall_score.toFixed(1)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </RiskCardContent>
          </RiskCard>

          {/* 分析维度 */}
          <RiskCard>
            <RiskCardContent className="space-y-2.5">
              <span className="text-xs font-medium text-neutral-400">
                分析维度
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DIMENSIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      void handleSend(`从${d}维度分析样本企业`)
                    }
                    disabled={loading}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[10px]",
                      "border-white/[0.08] text-neutral-500",
                      "hover:text-neutral-200 hover:border-white/[0.16] hover:bg-white/[0.04]",
                      "active:bg-white/[0.06]",
                      "transition-colors duration-200 ease-out",
                      "disabled:opacity-50",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </RiskCardContent>
          </RiskCard>

          {/* 历史对话记录 */}
          {sessions.length > 0 && (
            <RiskCard>
              <RiskCardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-neutral-500" />
                  <span className="text-xs font-medium text-neutral-400 tracking-wide">
                    历史对话
                  </span>
                  <span className="text-[10px] font-mono text-neutral-600">
                    {sessions.length}
                  </span>
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-1 group/session"
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchSession(s)}
                        className={cn(
                          "flex-1 text-left rounded-md px-2 py-1.5 text-[11px] text-neutral-400 truncate",
                          "hover:bg-white/[0.05] hover:text-neutral-200",
                          "active:bg-white/[0.07]",
                          "transition-colors duration-200 ease-out",
                        )}
                      >
                        {s.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id)}
                        className={cn(
                          "shrink-0 p-1 rounded text-neutral-700 opacity-0 group-hover/session:opacity-100",
                          "hover:text-rose-400 hover:bg-white/[0.06]",
                          "transition-all duration-200 ease-out",
                        )}
                        aria-label="删除对话"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </RiskCardContent>
            </RiskCard>
          )}
        </aside>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
}
