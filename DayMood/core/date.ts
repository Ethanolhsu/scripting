// 本地日期的小工具：小组件按「本地」换日，不能用 toISOString（那会按 UTC 算，早上 8 点前会差一天）。

function pad2(value: number): string {
  return value < 10 ? "0" + value : String(value);
}

/** yyyy-mm-dd，按本地时区 */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 截图里的 2026.12.01 */
export function dateText(date: Date): string {
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
}

/** 星期一 ~ 星期日；getDay() 的 0 是周日 */
export function weekdayText(date: Date): string {
  const names = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return names[date.getDay()] ?? "";
}

/** 1 = 周一 … 7 = 周日，方便映射五句工作日文案 */
export function weekdayIndex(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/** 次日 00:05，给 Widget.present 的下次刷新时间；跨天一定换状态 */
export function nextMidnight(date: Date): Date {
  const next = new Date(date.getTime());
  next.setHours(24, 0, 5, 0);
  return next;
}

/** 当天的 00:00 和次日 00:00，查全天事件用 */
export function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getTime());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  return { start, end };
}
