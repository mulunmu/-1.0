import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { matchEnterpriseQuery } from "@/lib/pinyin";
import type { EnterpriseAssessment } from "@/lib/api";

const MAX_RESULTS = 10;

interface SearchBoxProps {
  enterprises: EnterpriseAssessment[];
  className?: string;
  placeholder?: string;
  onSelect?: (id: string) => void;
  excludeIds?: string[];
}

export default function SearchBox({
  enterprises,
  className,
  placeholder = "搜索企业名称、编号或拼音首字母...",
  onSelect,
  excludeIds = [],
}: SearchBoxProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return enterprises
      .filter((e) => !excludeIds.includes(e.enterprise_id) && matchEnterpriseQuery(q, e))
      .slice(0, MAX_RESULTS);
  }, [query, enterprises, excludeIds]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(id: string) {
    setQuery("");
    setOpen(false);
    if (onSelect) {
      onSelect(id);
    } else {
      navigate(`/enterprise/${id}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      select(results[activeIndex].enterprise_id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative w-full max-w-xl", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>

      {open && query.trim() && (
        <ul className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-xl">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-neutral-500">未找到匹配企业</li>
          ) : (
            <>
              {results.map((item, idx) => (
                <li key={item.enterprise_id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-white/[0.06]",
                      idx === activeIndex && "bg-white/[0.06]",
                    )}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => select(item.enterprise_id)}
                  >
                    <span className="text-neutral-200 truncate">{item.enterprise_name}</span>
                    <span className="text-xs text-neutral-600 shrink-0">{item.enterprise_id}</span>
                  </button>
                </li>
              ))}
              {enterprises.filter((e) => !excludeIds.includes(e.enterprise_id) && matchEnterpriseQuery(query.trim(), e)).length > MAX_RESULTS && (
                <li className="px-4 py-2 text-[10px] text-neutral-600 border-t border-white/[0.06]">
                  仅展示前 {MAX_RESULTS} 条，请输入更精确关键词
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
