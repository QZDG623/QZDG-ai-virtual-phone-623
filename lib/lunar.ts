/**
 * 农历小字：基于 Intl 的 chinese 历法实现，零数据表。
 * 现代浏览器（Chromium / Safari / Firefox 均已支持 zh-u-ca-chinese）；
 * 不支持时静默返回 null，日历上不显示农历，不影响其它功能。
 */

const LUNAR_DAY_NAMES = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
] as const;

const LUNAR_MONTH_NAMES = [
  "正月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "冬月", "腊月",
] as const;

export type LunarInfo = {
  /** 月名，如 正月 / 闰四月 / 腊月 */
  monthLabel: string;
  /** 日名，如 初一 / 十五 / 廿三 */
  dayLabel: string;
  /** 当天是否初一（初一显示月名） */
  isFirstDay: boolean;
  /** 日历格子里显示的小字：初一显示月名，其余显示日名 */
  cellLabel: string;
  /** 节日名称 */
  holiday?: string;
};

// 常见公历节日（月-日）
const SOLAR_HOLIDAYS: Record<string, string> = {
  "01-01": "元旦",
  "02-14": "情人节",
  "03-08": "妇女节",
  "03-12": "植树节",
  "05-01": "劳动节",
  "05-04": "青年节",
  "06-01": "儿童节",
  "08-01": "建军节",
  "09-10": "教师节",
  "10-01": "国庆节",
  "12-24": "平安夜",
  "12-25": "圣诞节",
};

// 常见农历节日（月名-日名）
const LUNAR_HOLIDAYS: Record<string, string> = {
  "正月-初一": "春节",
  "正月-十五": "元宵",
  "二月-初二": "龙抬头",
  "五月-初五": "端午",
  "七月-七夕": "七夕",
  "七月-十五": "中元",
  "八月-十五": "中秋",
  "九月-初九": "重阳",
  "腊月-初八": "腊八",
  "腊月-廿三": "小年",
};

let lunarFormatter: Intl.DateTimeFormat | null | undefined;
const lunarCache = new Map<string, LunarInfo | null>();
const LUNAR_CACHE_LIMIT = 800;

function getFormatter(): Intl.DateTimeFormat | null {
  if (lunarFormatter !== undefined) return lunarFormatter;
  try {
    lunarFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      month: "numeric",
      day: "numeric",
    });
    // 简单自检：能格式化且能取出 month/day part 才算可用
    const parts = lunarFormatter.formatToParts(new Date(2024, 1, 10));
    if (!parts.some(part => part.type === "day")) lunarFormatter = null;
  } catch {
    lunarFormatter = null;
  }
  return lunarFormatter;
}

/** 取某天的农历信息；环境不支持时返回 null。 */
export function getLunarInfo(date: Date): LunarInfo | null {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  if (lunarCache.has(key)) return lunarCache.get(key) ?? null;

  const formatter = getFormatter();
  let info: LunarInfo | null = null;
  if (formatter) {
    try {
      const parts = formatter.formatToParts(date);
      const monthPart = parts.find(part => part.type === "month")?.value ?? "";
      const dayPart = parts.find(part => part.type === "day")?.value ?? "";
      const dayNumber = Number(dayPart);
      if (dayNumber >= 1 && dayNumber <= 30) {
        // month 可能是 "四"、"4"、"闰四" 等形态，统一转成中文月名
        const isLeap = monthPart.includes("闰");
        const monthText = monthPart.replace("闰", "").replace("月", "");
        const monthIndex = resolveMonthIndex(monthText);
        const monthLabel = monthIndex >= 0
          ? `${isLeap ? "闰" : ""}${LUNAR_MONTH_NAMES[monthIndex]}`
          : `${isLeap ? "闰" : ""}${monthText}月`;
        const dayLabel = LUNAR_DAY_NAMES[dayNumber - 1];
        
        // 匹配农历与公历节日
        const mStr = String(date.getMonth() + 1).padStart(2, "0");
        const dStr = String(date.getDate()).padStart(2, "0");
        const solarKey = `${mStr}-${dStr}`;
        const solarHoliday = SOLAR_HOLIDAYS[solarKey];

        // 农历节日匹配（只按月名和日名精确匹配）
        // 如 "正月-初一" -> "春节"
        const lunarKey = `${monthLabel}-${dayLabel}`;
        const lunarHoliday = LUNAR_HOLIDAYS[lunarKey];

        const holiday = lunarHoliday || solarHoliday;
        
        info = {
          monthLabel,
          dayLabel,
          isFirstDay: dayNumber === 1,
          cellLabel: holiday || (dayNumber === 1 ? monthLabel : dayLabel),
          holiday,
        };
      }
    } catch {
      info = null;
    }
  }

  if (lunarCache.size >= LUNAR_CACHE_LIMIT) lunarCache.clear();
  lunarCache.set(key, info);
  return info;
}

const CN_MONTH_TEXTS = ["正", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "冬", "腊"];

function resolveMonthIndex(text: string): number {
  const numeric = Number(text);
  if (numeric >= 1 && numeric <= 12) return numeric - 1;
  const idx = CN_MONTH_TEXTS.indexOf(text);
  if (idx < 0) return -1;
  if (text === "正" || text === "一") return 0;
  if (text === "冬" || text === "十一") return 10;
  if (text === "腊" || text === "十二") return 11;
  if (text === "十") return 9;
  const mapped = Number.isNaN(numeric) ? CN_MONTH_TEXTS.indexOf(text) : numeric;
  // 二~九
  const base = ["二", "三", "四", "五", "六", "七", "八", "九"].indexOf(text);
  if (base >= 0) return base + 1;
  return mapped >= 0 && mapped <= 11 ? mapped : -1;
}

/** ISO(YYYY-MM-DD) 版便捷入口。 */
export function getLunarInfoByIso(isoDate: string): LunarInfo | null {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return getLunarInfo(date);
}
