import { useCallback, useEffect, useState } from "react";
import type { EnterpriseAssessment } from "@/lib/api";
import { fetchEnterprises, getInstantEnterprises } from "@/lib/dataSource";

interface UseEnterpriseCatalogOptions {
  /** 是否在后台静默刷新 live 数据（不显示 loading） */
  refresh?: boolean;
}

export function useEnterpriseCatalog(options: UseEnterpriseCatalogOptions = {}) {
  const { refresh = true } = options;
  const [enterprises, setEnterprises] = useState<EnterpriseAssessment[]>(() =>
    getInstantEnterprises(),
  );
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (showSync = true) => {
    if (showSync) setSyncing(true);
    setError(null);
    try {
      const data = await fetchEnterprises();
      setEnterprises(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "企业数据加载失败");
    } finally {
      if (showSync) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (refresh) reload(false);
  }, [refresh, reload]);

  return { enterprises, syncing, error, reload };
}
