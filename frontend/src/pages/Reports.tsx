import { FileText, Download, Mail, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const REPORT_TYPES: { icon: LucideIcon; title: string; status: "可用" | "开发中" }[] = [
  { icon: FileText, title: "单企业报告", status: "可用" },
  { icon: Download, title: "批量导出", status: "开发中" },
  { icon: Mail, title: "邮件推送", status: "开发中" },
  { icon: Clock, title: "历史归档", status: "开发中" },
];

export default function Reports() {
  return (
    <div className="w-full fade-in pb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {REPORT_TYPES.map((item) => (
          <Card
            key={item.title}
            className={cn(
              "glass transition-colors",
              item.status === "可用" ? "hover:border-white/15 cursor-pointer" : "opacity-60",
            )}
          >
            <CardContent className="flex flex-col items-center gap-3 py-8 px-4">
              <div className="w-11 h-11 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
                <item.icon size={20} className="text-neutral-400" strokeWidth={1.5} />
              </div>
              <span className="text-sm text-neutral-300">{item.title}</span>
              {item.status === "开发中" && (
                <span className="text-[10px] text-neutral-600 border border-white/[0.06] rounded-full px-2 py-0.5">
                  即将上线
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
