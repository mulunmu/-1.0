/** 全站数据边界标注 */
export default function DataBoundaryTag({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] sm:text-xs text-neutral-500 backdrop-blur-sm ${className}`}
    >
      模拟数据 · 200家企业 · 字段对齐真实税务数据结构 · 真实数据导入后无缝切换
    </div>
  );
}
