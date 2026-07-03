import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Markdown from "react-markdown";
import { ArrowLeft, Bot, Loader2, Send, User } from "lucide-react";
import ChatInlineChart from "@/components/ChatInlineChart";
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

const SUGGESTIONS = [
  "分析深圳明达科技的税务健康",
  "样本企业行业排名",
  "对比深圳明达和上海恒信",
  "有哪些风险预警",
];

const SESSION_NOTE_KEY = "risk-chat-session-note-shown";

export default function ChatPanel() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionNote, setSessionNote] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const listRef = useRef<HTMLDivElement>(null);
  const initialQuery = searchParams.get("q");

  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      setInput(initialQuery);
    }
  }, [initialQuery, messages.length]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(text?: string) {
    const query = (text ?? input).trim();
    if (!query || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendChat(query, sessionId);
      if (res.session_note && !localStorage.getItem(SESSION_NOTE_KEY)) {
        setSessionNote(res.session_note);
        localStorage.setItem(SESSION_NOTE_KEY, "1");
      }
      const replyText = res.reply?.trim() || "暂无文字回复，请查看下方图表与数据详情。";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: replyText, response: res },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: e instanceof Error ? e.message : "请求失败，请重试",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold">AI 分析助手</h1>
            <p className="text-xs text-slate-500">自然语言提问，自动路由分析模块</p>
          </div>
        </div>
        <Bot className="h-6 w-6 text-blue-400" />
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {sessionNote && (
          <div className="mx-auto mb-4 max-w-2xl rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-2 text-xs text-amber-200/90">
            {sessionNote}
          </div>
        )}
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl text-center">
            <Bot className="mx-auto mb-4 h-12 w-12 text-blue-400/60" />
            <p className="mb-6 text-slate-400">试试这些问题：</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-blue-500/50 hover:bg-slate-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  msg.role === "user" ? "bg-blue-600" : "bg-slate-700",
                )}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4 text-blue-400" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-700 bg-card text-slate-200",
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-slate-100">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                ) : (
                  msg.content
                )}
                {msg.response?.charts && (
                  <div className="mt-3 border-t border-slate-700 pt-3">
                    <ChatInlineChart charts={msg.response.charts} />
                  </div>
                )}
                {msg.response?.intent && (
                  <p className="mt-2 text-xs text-slate-500">意图：{msg.response.intent}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                <Bot className="h-4 w-4 text-blue-400" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-card px-4 py-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                分析中...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="输入问题，如：分析深圳明达科技的税务健康"
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={() => handleSend()} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
