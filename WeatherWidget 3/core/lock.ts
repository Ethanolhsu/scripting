// 锁屏组件的款式表：圆形 8 款、矩形 5 款，编号按形状各自从 1 数。
//
// 每款是从「彩云天气」的锁屏设计稿搬过来的：圆形按 72×72、矩形按 160×72 排，
// 内容（图标、数字、弧线、流线、刻度）都在 widget/lock/styles.tsx 里按设计稿的坐标画。
//
// 一个锁屏组件只能放一款，所以款式靠组件自己的「参数」选：填编号（如 `3`）或名字（如「紫外线指数」）；
// 不填、或者填的不是这种形状的款式，用 App 页「锁屏样式」里选的那一款（见 core/settings.ts）。
// 矩形也认 9~13（v1.0 的十款编号是圆形、矩形连在一起数的，老用户填过的数字照样认）。

export type LockFamilyKey = "circle" | "rect";

export type LockStyle = {
  readonly value: string;
  readonly label: string;
  readonly family: LockFamilyKey;
};

export const LOCK_STYLES: readonly LockStyle[] = [
  { value: "current", label: "天气实况", family: "circle" },
  { value: "highLow", label: "当日高低温", family: "circle" },
  { value: "uv", label: "紫外线指数", family: "circle" },
  { value: "aqiArc", label: "空气质量弧线", family: "circle" },
  { value: "aqiOrbit", label: "空气质量星轨", family: "circle" },
  { value: "wind", label: "风速风向", family: "circle" },
  { value: "rainChance", label: "降水概率", family: "circle" },
  { value: "sun", label: "日出日落", family: "circle" },
  { value: "nowcast", label: "短临预报", family: "rect" },
  { value: "rainfall", label: "降雨量预报", family: "rect" },
  { value: "currentHourly", label: "实况与逐时", family: "rect" },
  { value: "windHumidity", label: "风与湿度", family: "rect" },
  { value: "currentDaily", label: "实况与逐日", family: "rect" },
];

/** 某种形状（圆形 / 矩形）的款式，顺序就是编号顺序 */
export function lockStylesOf(family: LockFamilyKey): readonly LockStyle[] {
  return LOCK_STYLES.filter((style) => style.family === family);
}

/**
 * 在某种形状里找一款：编号从 1 数、代号（value）或名字（label）都认，找不到是 null。
 * 矩形多认 9~13：那是把圆形、矩形连着数的老编号（9 短临预报 … 13 实况与逐日），和现在的 1~5 差 8。
 */
export function findLockStyle(text: string | null | undefined, family: LockFamilyKey): LockStyle | null {
  const key = typeof text === "string" ? text.trim() : "";
  if (key === "") return null;
  const list = lockStylesOf(family);
  if (/^\d+$/.test(key)) {
    const number = Number.parseInt(key, 10);
    const picked = list[number - 1] ?? (family === "rect" ? list[number - 1 - lockStylesOf("circle").length] : undefined);
    return picked ?? null;
  }
  return list.find((style) => style.value === key || style.label === key) ?? null;
}

/** App 页「锁屏样式」里给这种形状选的那一款；没选过、或者存的值不认识，用第一款 */
export function defaultLockStyle(family: LockFamilyKey, saved: string): LockStyle {
  return findLockStyle(saved, family) ?? lockStylesOf(family)[0];
}

/**
 * 这个锁屏组件画哪一款：参数里填了这种形状的款式就用它，否则用设置里选的那一款。
 * `parameter` 是组件「参数」那一栏的原文，可能也是地点（纬度,经度,名称），认不出款式就返回默认款。
 */
export function resolveLockStyle(family: LockFamilyKey, settings: { lockCircle: string; lockRect: string }, parameter: string | null | undefined): LockStyle {
  const picked = findLockStyle(parameter, family);
  if (picked !== null) return picked;
  return defaultLockStyle(family, family === "circle" ? settings.lockCircle : settings.lockRect);
}

/** 设置里那一款的名字（「3 紫外线指数」），列表里显示用 */
export function lockStyleTitle(style: LockStyle): string {
  const list = lockStylesOf(style.family);
  return list.indexOf(style) + 1 + " " + style.label;
}
