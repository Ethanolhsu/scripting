// 当天状态的唯一入口：日期 + 星期 + 状态（工作日/周末/法定节假日/调休补班）+ 配图 + 短句。
// 日历结果优先，其次当天的缓存，最后退回普通工作日/周末；日历出错绝不让小组件空着。

import { artFor, type ArtKey } from "../assets/lineArt";
import { dateText, weekdayIndex, weekdayText } from "./date";
import { cachedMarkFor, readCalendarMark } from "./holiday";
import type { Settings } from "./settings";
import type { CalendarMark } from "./store";

export type DayKind = "work" | "weekend" | "holiday" | "makeup";

export type DayState = {
  date: string;
  weekday: string;
  kind: DayKind;
  /** 牌子上的四个字 */
  phrase: string;
  /** 插画用哪一张；周末两天共用 weekend */
  art: ArtKey;
  /** 节假日/补班时在星期后面补一句；普通工作日为空 */
  tag: string;
};

/** 五天工作日各一句，和截图里的五张对应 */
function workPhrase(index: number): string {
  switch (index) {
    case 1:
      return "自愿上班";
    case 2:
      return "搬砖快乐";
    case 3:
      return "无需打卡";
    case 4:
      return "带薪划水";
    case 5:
      return "掐点跑路";
    default:
      return "自愿上班";
  }
}

function artOfWork(index: number): ArtKey {
  switch (index) {
    case 1:
      return "mon";
    case 2:
      return "tue";
    case 3:
      return "wed";
    case 4:
      return "thu";
    case 5:
      return "fri";
    default:
      return "mon";
  }
}

/** 不读日历的基础状态：按星期几分工作日/周末 */
export function baseState(now: Date): DayState {
  const index = weekdayIndex(now);
  const weekend = index >= 6;
  return {
    date: dateText(now),
    weekday: weekdayText(now),
    kind: weekend ? "weekend" : "work",
    phrase: weekend ? "不想努力" : workPhrase(index),
    art: weekend ? "weekend" : artOfWork(index),
    tag: "",
  };
}

/** 把日历结果叠到基础状态上 */
export function applyMark(now: Date, mark: CalendarMark | null): DayState {
  const state = baseState(now);
  if (mark === null) return state;
  if (mark.kind === "makeup") {
    return { ...state, kind: "makeup", phrase: "被迫补班", art: "makeup", tag: "调休补班" };
  }
  return {
    ...state,
    kind: "holiday",
    phrase: "带薪休假",
    art: "holiday",
    tag: mark.name === "法定节假日" ? "法定放假" : `${mark.name}·放假`,
  };
}

/** 小组件主流程：优先现场读日历，读不到用当天缓存 */
export async function resolveToday(settings: Settings, now: Date): Promise<DayState> {
  const mark = (await readCalendarMark(settings, now)) ?? cachedMarkFor(now);
  return applyMark(now, mark);
}

export { artFor };
