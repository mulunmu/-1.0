/** 与后端 registry initials 字段对齐的轻量匹配 */
const PINYIN: Record<string, string> = {
  深: "S", 圳: "Z", 上: "S", 海: "H", 北: "B", 京: "J", 广: "G", 州: "Z",
  杭: "H", 南: "N", 武: "W", 汉: "H", 成: "C", 都: "D", 天: "T", 津: "J",
  重: "C", 庆: "Q", 明: "M", 达: "D", 恒: "H", 信: "X", 科: "K", 技: "J",
  华: "H", 创: "C", 汇: "H", 通: "T", 鑫: "X", 源: "Y", 博: "B", 远: "Y",
  智: "Z", 云: "Y", 绿: "L", 光: "G", 谷: "G", 金: "J", 陵: "L", 山: "S",
  城: "C", 餐: "C", 饮: "Y", 有: "Y", 限: "X", 公: "G", 司: "S", 股: "G",
  份: "F", 集: "J", 团: "T", 实: "S", 业: "Y", 电: "D", 子: "Z", 制: "Z",
  造: "Z", 贸: "M", 易: "Y", 建: "J", 筑: "Z", 物: "W", 流: "L", 新: "X",
  能: "N", 医: "Y", 药: "Y", 融: "R", 市: "S", 省: "S",
};

export function computeInitials(name: string): string {
  return name
    .split("")
    .map((ch) => {
      if (/[a-zA-Z0-9]/.test(ch)) return ch.toUpperCase();
      return PINYIN[ch] ?? "";
    })
    .join("");
}

export function matchEnterpriseQuery(
  query: string,
  item: { enterprise_id: string; enterprise_name: string; initials?: string },
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (item.enterprise_id.toLowerCase() === q) return true;
  if (item.enterprise_id.toLowerCase().includes(q)) return true;
  if (item.enterprise_name.toLowerCase().includes(q)) return true;
  const initials = (item.initials ?? computeInitials(item.enterprise_name)).toLowerCase();
  if (initials.includes(q.toUpperCase()) || initials.toLowerCase().includes(q)) return true;
  return false;
}
