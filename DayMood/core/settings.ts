// App 页和小组件共用的那一份设置：文字/线框颜色、节假日日历。
// 存的时候只存能验的字段，读的时候不信任何一项，坏值一律退回默认。

export type Settings = {
  /** 日期、星期、短句、牌子边框的颜色。颜色值来自系统取色器（十六进制字符串） */
  color: string;
  /** 系统日历的 identifier；为空时退回按标题匹配 */
  calendarID: string;
  /** 系统日历标题；默认「中国大陆节假日」，App 页可以换 */
  calendarTitle: string;
};

export const DEFAULT_COLOR = "#111111";
export const DEFAULT_CALENDAR_TITLE = "中国大陆节假日";

export function defaultSettings(): Settings {
  return { color: DEFAULT_COLOR, calendarID: "", calendarTitle: DEFAULT_CALENDAR_TITLE };
}

function cleanColor(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_COLOR;
  const text = value.trim().slice(0, 40);
  return text === "" ? DEFAULT_COLOR : text;
}

function cleanTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 30);
}

export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return defaultSettings();
  const record = raw as Record<string, unknown>;
  return {
    color: cleanColor(record.color),
    calendarID: typeof record.calendarID === "string" ? record.calendarID.trim().slice(0, 120) : "",
    calendarTitle: cleanTitle(record.calendarTitle) || DEFAULT_CALENDAR_TITLE,
  };
}

/** 取色器给的颜色可能是 #rgb/#rrggbb，也可能是 rgba()/颜色名；只做够用的亮度判断 */
export function isLightColor(color: string): boolean {
  const text = color.trim().toLowerCase();
  if (text === "white" || text === "systembackground") return true;
  if (text === "black" || text === "label" || text === "darktext") return false;

  let hex = "";
  if (text.startsWith("#")) hex = text.slice(1);
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(text);
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length >= 6) {
    const value = Number.parseInt(hex.slice(0, 6), 16);
    if (Number.isFinite(value)) {
      const r = (value >> 16) & 255;
      const g = (value >> 8) & 255;
      const b = value & 255;
      return (r * 299 + g * 587 + b * 114) / 1000 > 150;
    }
  }
  if (rgb !== null) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }
  return false;
}

/** 牌子的底色：字深就白底，字浅就黑底，保证短句永远能读 */
export function signBackground(color: string): string {
  return isLightColor(color) ? "rgba(18,18,20,0.94)" : "rgba(255,255,255,0.94)";
}
