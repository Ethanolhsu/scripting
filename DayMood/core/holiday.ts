// 节假日只从「用户指定的那个系统日历」里读：
//   · 当天有不会重复的全天事件，标题含 补班/上班/调休/补课/值班 → 调休工作日
//   · 其余全天事件 → 法定节假日，标题作为节日名
// 小组件里弹不了授权框，所以首次必须在 App 页授权日历；组件读到结果后当天缓存，读不到就用缓存/普通工作日。

import { dayKey, dayRange } from "./date";
import type { Settings } from "./settings";
import { clearMark, readMark, writeMark, type CalendarMark } from "./store";

type EventLike = {
  title: string;
  isAllDay: boolean;
  startDate: Date;
  endDate: Date;
  calendar?: { identifier: string; title: string } | null;
};

type CalendarLike = { identifier: string; title: string };

declare const Calendar:
  | { forEvents(): Promise<CalendarLike[]> }
  | undefined;
declare const CalendarEvent:
  | { getAll(startDate: Date, endDate: Date, calendars?: CalendarLike[] | null): Promise<EventLike[]> }
  | undefined;

export type CalendarOption = { id: string; title: string };

const MAKEUP = /补班|上班|调休|补课|值班/;

/** App 设置页用它列系统里所有能放事件的日历；会触发系统日历权限 */
export async function listEventCalendars(): Promise<CalendarOption[]> {
  if (typeof Calendar === "undefined") return [];
  const calendars = await Calendar.forEvents();
  return calendars
    .filter((calendar) => calendar.title.trim() !== "")
    .map((calendar) => ({ id: calendar.identifier, title: calendar.title.trim() }))
    .sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"));
}

/** 从事件标题里取一个能放在小组件上的节日名：「春节 2月17日」→「春节」 */
function holidayName(raw: string): string {
  let text = raw.trim();
  text = text.replace(/[（(].*$/, "").trim();
  text = text.split(/[\s，,、:：]/)[0] ?? text;
  text = text.replace(/放假|休假|法定节假日|节假日/g, "").trim();
  if (text === "" || text === "休" || text === "班") return "法定节假日";
  return text.slice(0, 6);
}

/** 只保留属于用户指定的那个日历的全天事件 */
function belongs(event: EventLike, settings: Settings): boolean {
  const calendar = event.calendar;
  if (calendar === null || calendar === undefined) return false;
  if (settings.calendarID !== "") return calendar.identifier === settings.calendarID;
  return calendar.title.trim() === settings.calendarTitle.trim();
}

/**
 * 读当天的日历标记。没有设置日历、没有权限、没有相关事件都返回 null，
 * 由调用方按普通工作日/周末画，不影响小组件出图。
 */
export async function readCalendarMark(settings: Settings, now: Date): Promise<CalendarMark | null> {
  if (typeof CalendarEvent === "undefined") return null;
  if (settings.calendarID === "" && settings.calendarTitle.trim() === "") return null;

  const { start, end } = dayRange(now);
  const key = dayKey(now);
  try {
    const all = await CalendarEvent.getAll(start, end, null);
    const relevant = all.filter(
      (event) =>
        event.isAllDay &&
        event.startDate.getTime() < end.getTime() &&
        event.endDate.getTime() > start.getTime() &&
        belongs(event, settings),
    );
    if (relevant.length === 0) {
      clearMark();
      return null;
    }

    // 同一天既有节日又有「上班」：补班优先，避免把调休日画成放假
    const makeup = relevant.find((event) => MAKEUP.test(event.title));
    if (makeup !== undefined) {
      const mark: CalendarMark = { day: key, kind: "makeup", name: "调休补班" };
      writeMark(mark);
      return mark;
    }

    const holiday = relevant.find((event) => !MAKEUP.test(event.title)) ?? relevant[0];
    const mark: CalendarMark = { day: key, kind: "holiday", name: holidayName(holiday.title) };
    writeMark(mark);
    return mark;
  } catch {
    // 没授权、日历被删、系统拒绝：当天缓存还在就用缓存
    const cached = readMark();
    return cached !== null && cached.day === key ? cached : null;
  }
}

/** 只读缓存，给小组件在没有日历权限时兜底 */
export function cachedMarkFor(now: Date): CalendarMark | null {
  const cached = readMark();
  return cached !== null && cached.day === dayKey(now) ? cached : null;
}
