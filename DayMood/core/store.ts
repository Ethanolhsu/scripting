// 设置和当天日历结果的存储。App 与小组件是两个运行环境，共用这份 Storage。

import { defaultSettings, parseSettings, type Settings } from "./settings";

const SETTINGS_KEY = "daymood.settings.v1";
const MARK_KEY = "daymood.calendar-mark.v1";

export type CalendarMark = {
  /** 本地日期 yyyy-mm-dd，只有同一天的结果才拿来用 */
  day: string;
  kind: "holiday" | "makeup";
  /** 节日名；补班固定写「调休补班」 */
  name: string;
};

export function loadSettings(): Settings {
  try {
    return parseSettings(Storage.get<unknown>(SETTINGS_KEY));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  Storage.set(SETTINGS_KEY, settings);
}

export function readMark(): CalendarMark | null {
  try {
    const raw = Storage.get<unknown>(MARK_KEY);
    if (typeof raw !== "object" || raw === null) return null;
    const record = raw as Record<string, unknown>;
    if (record.kind !== "holiday" && record.kind !== "makeup") return null;
    if (typeof record.day !== "string" || typeof record.name !== "string") return null;
    return { day: record.day, kind: record.kind, name: record.name };
  } catch {
    return null;
  }
}

export function writeMark(mark: CalendarMark): void {
  Storage.set(MARK_KEY, mark);
}

export function clearMark(): void {
  Storage.remove(MARK_KEY);
}
