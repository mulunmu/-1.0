import { Navigate, useSearchParams } from "react-router-dom";
import { CHAT_QUERIES, chatUrl } from "@/lib/routes";

/** 原 /search → 智能分析 */
export function SearchRedirect() {
  return <Navigate to={chatUrl(CHAT_QUERIES.search)} replace />;
}

/** 原 /warnings → 智能分析 */
export function WarningsRedirect() {
  return <Navigate to={chatUrl(CHAT_QUERIES.warnings)} replace />;
}

/** 原 /pk → 智能分析，保留 ?ids= 参数语义 */
export function PKRedirect() {
  const [params] = useSearchParams();
  const ids = params
    .get("ids")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const query = ids?.length ? CHAT_QUERIES.compareIds(ids) : CHAT_QUERIES.compareDefault;
  return <Navigate to={chatUrl(query)} replace />;
}
