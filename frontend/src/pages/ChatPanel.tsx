import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Markdown from "react-markdown";
import { Send, User, BarChart3, GitCompare, AlertTriangle, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ChatInlineChart from "@/components/ChatInlineChart";
import LineSigil from "@/components/LineSigil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendChat, type ChatResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
}

const QUICK_ACTIONS: { label: string; query: string; Icon: LucideIcon }[] = [
  { label: "税务健康", query: "分析深圳明达科技的税务健康", Icon: ShieldCheck },
  { label: "行业排名", query: "样本企业行业排名", Icon: BarChart3 },
  { label: "企业对比", query: "对比深圳明达和上海恒信", Icon: GitCompare },
  { label: "风险预警", query: "有哪些风险预警", Icon: AlertTriangle },
];

const BOILERPLATE_REPLY = "暂无文字回复，请查看下方图表与数据详情。";

function shouldShowText(content: string, hasChart: boolean): boolean {
  if (!content.trim()) return false;
  if (hasChart && (content === BOILERPLATE_REPLY || content.length < 30)) return false;
  return true;
}

export default function ChatPanel() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const listRef = useRef<HTMLDivElement>(null);
  const initialQuery = searchParams.get("q");

  useEffect(() => {
    if (initialQuery && messages.length === 0) setInput(initialQuery);
  }, [initialQuery, messages.length]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(text?: string) {
    const query = (text ?? input).trim();
    if (!query || loading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: query }]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendChat(query, sessionId);
      const replyText = res.reply?.trim() || BOILERPLATE_REPLY;
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: replyText, response: res }]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: e instanceof Error ? e.message : "请求失败",
      }]);
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-transparent">
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 min-h-0 bg-transparent">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center min-h-full py-8">
            <LineSigil mode="idle" size={48} className="mb-8 opacity-90" />
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              {QUICK_ACTIONS.map(({ label, query, Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSend(query)}
                  disabled={loading}
                  className="glass-card flex flex-col items-center gap-2.5 rounded-2xl px-4 py-5 transition-transform hover:scale-[1.02] disabled:opacity-50"
                >
                  <Icon size={22} className="text-neutral-400" strokeWidth={1.5} />
                  <span className="text-sm text-neutral-300">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => {
            const hasChart = Boolean(msg.response?.charts);
            const showText = msg.role === "assistant"
              ? shouldShowText(msg.content, hasChart)
              : true;

            return (
              <div
                key={msg.id}
                className={cn("flex gap-2 sm:gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]",
                    msg.role === "user" && "text-neutral-400",
                  )}
                >
                  {msg.role === "user"
                    ? <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    : <LineSigil mode="idle" size={28} />}
                </div>
                <div
                  className={cn(
                    "max-w-[88%] sm:max-w-[85%] rounded-2xl min-w-0 overflow-hidden text-sm",
                    msg.role === "user"
                      ? "border border-white/12 bg-white/[0.06] text-neutral-200 backdrop-blur-sm"
                      : "border border-white/10 bg-white/[0.03] text-neutral-200",
                    hasChart && msg.role === "assistant" && "w-full max-w-full sm:max-w-[92%]",
                  )}
                >
                  {hasChart && msg.response?.charts && (
                    <div className="p-3 sm:p-4">
                      <ChatInlineChart charts={msg.response.charts} />
                    </div>
                  )}
                  {showText && (
                    <div className={cn(
                      "text-sm break-words",
                      hasChart ? "px-3 sm:px-4 pb-3 sm:pb-4 pt-0 border-t border-white/[0.06]" : "px-3 sm:px-4 py-2.5 sm:py-3",
                    )}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-neutral-100">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-center py-6">
              <LineSigil mode="thinking" size={40} />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/[0.06] px-4 sm:px-6 py-3 sm:py-4 shrink-0 bg-transparent">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="输入分析问题…"
            disabled={loading}
            className="flex-1 min-w-0 h-11 bg-white/[0.04] border-white/10 focus:border-white/20"
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="shrink-0 h-11 w-11 p-0 border border-white/15 bg-white/[0.08] text-neutral-200 hover:bg-white/[0.12] hover:text-white"
            aria-label="发送"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
