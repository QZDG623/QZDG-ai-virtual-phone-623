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
  /** 节假日或节气名称（如果有） */
  holiday?: string;
  /** 是否是法定/传统主要节日（用于特殊样式，比如红色） */
  isMajorHoliday?: boolean;
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
        // 获取公历和农历节假日与二十四节气
        const solarHoliday = getSolarHoliday(date);
        const lunarHoliday = getLunarHoliday(monthLabel, dayLabel, date);
        const solarTerm = getSolarTerm(date);

        const holiday = solarHoliday || lunarHoliday || solarTerm;
        const isMajorHoliday = !!(solarHoliday || lunarHoliday);

        info = {
          monthLabel,
          dayLabel,
          isFirstDay: dayNumber === 1,
          cellLabel: holiday || (dayNumber === 1 ? monthLabel : dayLabel),
          holiday: holiday || undefined,
          isMajorHoliday,
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

/** 公历节假日定义 */
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

/** 农历主节日定义 */
const LUNAR_HOLIDAYS: Record<string, string> = {
  "正月初一": "春节",
  "正月十五": "元宵节",
  "二月初二": "龙抬头",
  "五月初五": "端午节",
  "七月初七": "七夕节",
  "七月十五": "中元节",
  "八月十五": "中秋节",
  "九月初九": "重阳节",
  "腊月初八": "腊八节",
  "腊月二十三": "小年",
  "腊月二十四": "小年",
};

/** 计算二十四节气（简易常数拟合公式，支持 2000-2099 年） */
function getSolarTerm(date: Date): string | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  const termNames = [
    "小寒", "大寒", "立春", "雨水", "惊蛰", "春分",
    "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
    "小暑", "大暑", "立秋", "处暑", "白露", "秋分",
    "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"
  ];

  // 每个节气在 21 世纪的 C 常数与索引
  const sTermInfo = [
    0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
    263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
  ];

  // 1900-01-01 02:36:57 是小寒
  const baseDate = new Date(1900, 0, 6, 2, 5, 0);

  // 寻找当月的两个节气
  // 每个月有两个节气，第 1 个节气索引为 (month-1)*2，第 2 个为 (month-1)*2 + 1
  const t1Idx = (month - 1) * 2;
  const t2Idx = t1Idx + 1;

  const getTermDay = (idx: number) => {
    const minutes = 525948.76 * (year - 1900) + sTermInfo[idx];
    const termDate = new Date(baseDate.getTime() + minutes * 60000);
    return termDate.getDate();
  };

  if (day === getTermDay(t1Idx)) {
    return termNames[t1Idx];
  }
  if (day === getTermDay(t2Idx)) {
    return termNames[t2Idx];
  }

  return null;
}

function getSolarHoliday(date: Date): string | null {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const key = `${mm}-${dd}`;
  return SOLAR_HOLIDAYS[key] || null;
}

function getLunarHoliday(monthLabel: string, dayLabel: string, date?: Date): string | null {
  const key = `${monthLabel}${dayLabel}`;
  if (LUNAR_HOLIDAYS[key]) {
    return LUNAR_HOLIDAYS[key];
  }
  // 特殊处理除夕：正月初一的前一天
  if (date) {
    const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const formatter = getFormatter();
    if (formatter) {
      try {
        const parts = formatter.formatToParts(tomorrow);
        const monthPart = parts.find(part => part.type === "month")?.value ?? "";
        const dayPart = parts.find(part => part.type === "day")?.value ?? "";
        const dayNumber = Number(dayPart);
        const isLeap = monthPart.includes("闰");
        const monthText = monthPart.replace("闰", "").replace("月", "");
        const monthIndex = resolveMonthIndex(monthText);
        const tMonthLabel = monthIndex >= 0 ? LUNAR_MONTH_NAMES[monthIndex] : "";
        if (!isLeap && tMonthLabel === "正月" && dayNumber === 1) {
          return "除夕";
        }
      } catch {}
    }
  }
  return null;
}

/** ISO(YYYY-MM-DD) 版便捷入口。 */
export function getLunarInfoByIso(isoDate: string): LunarInfo | null {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return getLunarInfo(date);
}
