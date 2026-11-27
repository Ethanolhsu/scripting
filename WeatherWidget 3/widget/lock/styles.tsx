// 锁屏的 13 款：圆形 8 款（天气实况、当日高低温、紫外线、空气弧线、空气星轨、风速风向、降水概率、日出日落），
// 矩形 5 款（短临预报、降雨量预报、实况与逐时、风与湿度、实况与逐日）。
//
// 版面和坐标都照「彩云天气」的锁屏设计稿：圆形 72×72、矩形 160×72，数字是设计稿的数，
// 由 widget/lock/design.ts 换算成组件的实际点数。锁屏是单色，所以只用白色和不同的透明度分主次，
// 弧线、流线、柱子用 Canvas 画（widget/lock/pen.ts），文字和图标用真的 Text / Image（widget/lock/view.tsx）。
//
// 读不到的数据一律写 `--`（或者空着那一块），不拿 0 冒充：备用来源（Open-Meteo）没有紫外线、空气、风、湿度、短临降水。

import { HStack, Text, ZStack, type VirtualNode } from "scripting";
import type { Card, LockView } from "../../core/present";
import type { LockFamilyKey, LockStyle } from "../../core/lock";
import type { LockDesign } from "./design";
import { LockAuxGlyph, LockAuxIcon, LockCanvas, LockLongNumber, LockNumberUnit, LockText, LockWeatherIcon } from "./view";
import type { LockPen } from "./pen";

/** 设计稿里的两种渐变：sweep 两头淡、中间偏右最亮（流线、轨迹）；fadeOut 从亮渐渐淡掉（弧线） */
function ramp(stops: ReadonlyArray<readonly [number, number]>): (t: number) => number {
  return (t) => {
    const value = Math.min(1, Math.max(0, t));
    const index = stops.findIndex(([at]) => at >= value);
    if (index <= 0) return stops[0][1];
    const [a, alphaA] = stops[index - 1];
    const [b, alphaB] = stops[index];
    return alphaA + ((alphaB - alphaA) * (value - a)) / (b - a);
  };
}

const sweep = ramp([
  [0, 0.05],
  [0.22, 0.75],
  [0.55, 1],
  [0.82, 0.6],
  [1, 0.04],
]);
const fadeOut = ramp([
  [0, 1],
  [0.6, 0.9],
  [1, 0.06],
]);

/** 设计稿的那道流线（中间低、两头翘、两头淡）：中心在 (x, y)、宽 width */
function underline(pen: LockPen, x: number, y: number, width: number, thickness = Math.max(1.8, width * 0.045)): void {
  const k = width / 64;
  const points = pen
    .bezier({ x: 3, y: 5 }, { x: 21, y: 1 }, { x: 42, y: 15 }, { x: 61, y: 4.5 })
    .map((point) => ({ x: x - width / 2 + point.x * k, y: y - (13 * k) / 2 + point.y * k }));
  pen.fade(points, thickness, (t) => sweep(t));
}

/** 降水用的云雨图标：现在下雨 / 下雪就用现在的天气，否则用小雨 */
function rainSymbol(card: Card): string {
  const sky = card.condition.sky;
  return sky === "rain" || sky === "snow" || sky === "storm" ? card.condition.symbol : "cloud.drizzle.fill";
}

/** 温度数字：null / NaN 写 --，其余带 ° */
function deg(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "--" : Math.round(value) + "°";
}

/** 紫外线强弱分几段点亮（0~5）：按彩云给的等级文字（很弱、弱、中等、强、很强），没有文字时按指数大小 */
function uvLevel(lock: LockView): number {
  const levels = ["很弱", "弱", "中等", "强", "很强"];
  const byText = lock.uvText === null ? -1 : levels.indexOf(lock.uvText);
  if (byText >= 0) return byText + 1;
  const value = lock.uvIndex;
  if (value === null || value <= 0) return 0;
  return value <= 2 ? 1 : value <= 4 ? 2 : value <= 6 ? 3 : value <= 9 ? 4 : 5;
}

function uvName(lock: LockView, level: number): string {
  if (lock.uvText !== null && lock.uvText !== "") return lock.uvText;
  return level === 0 ? "无" : ["很弱", "弱", "中等", "强", "很强"][level - 1];
}

type StyleProps = { d: LockDesign; card: Card; lock: LockView };

// ---------------------------------------------------------------- 圆形（72×72）

/** 01 天气实况：天气图标、大温度、天气文字，下面一道流线 */
function CurrentStyle({ d, card }: StyleProps) {
  return (
    <>
      <LockCanvas d={d} draw={(pen) => underline(pen, 36, 64.5, 34)} />
      <LockWeatherIcon d={d} symbol={card.condition.symbol} x={36} y={14} side={20} />
      <LockText d={d} text={card.temperature} x={36} y={37.5} size={27} weight="semibold" />
      <LockText d={d} text={card.condition.text} x={36} y={55.5} size={11} alpha={0.9} maxWidth={46} />
    </>
  );
}

/**
 * 02 当日高低温：一道下面开口的弧线，按「现在的温度在今天最低到最高之间的位置」点亮前一段，圆点停在现在的位置；
 * 中间温度计、现在的温度，下面今天的最低、最高温。最高最低相同或缺数据时只画灰色底轨。
 */
function HighLowStyle({ d, lock }: StyleProps) {
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          const from = -186;
          const to = 6;
          const radius = 31;
          const width = 3.4;
          const track = pen.gray();
          const valid = Number.isFinite(lock.temperature) && Number.isFinite(lock.low) && Number.isFinite(lock.high) && lock.high > lock.low;
          if (!valid) {
            pen.arc(36, 36, radius, from, to, width, track);
            return;
          }
          const ratio = Math.max(0, Math.min(1, (lock.temperature - lock.low) / (lock.high - lock.low)));
          const at = from + (to - from) * ratio;
          // 圆点前后各空出一点，和弧线分开
          const gap = (5 / radius / Math.PI) * 180;
          pen.arc(36, 36, radius, at + gap, to, width, track);
          pen.arc(36, 36, radius, from, at - gap, width, pen.white());
          const angle = (at * Math.PI) / 180;
          pen.dot(36 + radius * Math.cos(angle), 36 + radius * Math.sin(angle), 7);
        }}
      />
      <LockAuxIcon d={d} name="thermometer" x={36} y={18} width={9} height={12.75} />
      <LockText d={d} text={deg(lock.temperature)} x={36} y={38.5} size={27} weight="semibold" />
      <HStack spacing={2.2 * d.unit} position={{ x: d.X(36), y: d.Y(57.5) }}>
        <LockAuxGlyph d={d} name="arrow_down" width={6.5} height={7.8} />
        <Text font={10 * d.unit} fontWeight="semibold" foregroundStyle="rgba(255,255,255,0.95)">{deg(lock.low)}</Text>
        <LockAuxGlyph d={d} name="arrow_up" width={6.5} height={7.8} />
        <Text font={10 * d.unit} fontWeight="semibold" foregroundStyle="rgba(255,255,255,0.95)">{deg(lock.high)}</Text>
      </HStack>
    </>
  );
}

/** 03 紫外线指数：上方五段刻度按等级点亮，中间紫外线太阳、指数，下面等级 */
function UvStyle({ d, lock }: StyleProps) {
  const level = uvLevel(lock);
  const segments: ReadonlyArray<readonly [number, number]> = [
    [192, 216],
    [225, 249],
    [258, 282],
    [291, 315],
    [324, 348],
  ];
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) =>
          segments.forEach(([from, to], index) => pen.arc(36, 36, 31, from, to, 3.6, index < level ? pen.white(0.96) : pen.gray()))
        }
      />
      <LockAuxIcon d={d} name="uv_sun" x={36} y={19} width={17} height={17} />
      <LockText d={d} text={lock.uvIndex === null ? "--" : String(Math.round(lock.uvIndex))} x={36} y={40.5} size={26} weight="semibold" />
      <LockText d={d} text={uvName(lock, level)} x={36} y={59} size={11} weight="semibold" alpha={0.9} maxWidth={34} />
    </>
  );
}

/** 04 空气质量 · 弧线：左上一道渐隐的弧线（装饰，不表示比例），空气图标、指数、等级，下面一道流线 */
function AqiArcStyle({ d, lock }: StyleProps) {
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          pen.fade(pen.arcPoints(36, 36, 31, 174, 325), 2.8, (t) => fadeOut(t));
          pen.dot(5.17, 39.24, 6);
          underline(pen, 36, 63.5, 30);
        }}
      />
      <LockAuxIcon d={d} name="air_quality" x={36} y={17} width={21} height={14} />
      <LockText d={d} text={lock.aqiValue === null ? "--" : String(Math.round(lock.aqiValue))} x={36} y={37.5} size={27} weight="semibold" maxWidth={50} />
      <LockText d={d} text={"AQI · " + (lock.aqiText ?? "--")} x={36} y={54.5} size={10.5} alpha={0.9} maxWidth={50} />
    </>
  );
}

/** 05 空气质量 · 星轨：上方一圈短刻度，叶片、指数、等级，外面绕一道斜的椭圆轨道（装饰），轨道上一颗小星 */
function AqiOrbitStyle({ d, lock }: StyleProps) {
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          // 上方 6 根短刻度（围着 (36, 33.5)，半径 25.4～28）
          [200, 227, 254, 286, 313, 340].forEach((angle) => {
            const cos = Math.cos((angle * Math.PI) / 180);
            const sin = Math.sin((angle * Math.PI) / 180);
            pen.line(
              [
                { x: 36 + 25.4 * cos, y: 33.5 + 25.4 * sin },
                { x: 36 + 28.6 * cos, y: 33.5 + 28.6 * sin },
              ],
              2,
              pen.white(0.95),
              true,
            );
          });
          // 斜的椭圆轨道：中心 (37, 54.5)、横半轴 26.7、竖半轴 7.5、逆时针斜 9°
          const tilt = (-9 * Math.PI) / 180;
          const orbit = (theta: number): { x: number; y: number } => {
            const ex = 26.7 * Math.cos(theta);
            const ey = 7.5 * Math.sin(theta);
            return { x: 37 + ex * Math.cos(tilt) - ey * Math.sin(tilt), y: 54.5 + ex * Math.sin(tilt) + ey * Math.cos(tilt) };
          };
          const half = (from: number, to: number): { x: number; y: number }[] =>
            Array.from({ length: 61 }, (_, index) => orbit(from + ((to - from) * index) / 60));
          pen.line(half(Math.PI, Math.PI * 2), 1, pen.white(0.45));
          pen.fade(half(0, Math.PI), 1.7, (t) => sweep(1 - t));
          const star = orbit((110 * Math.PI) / 180);
          pen.dot(star.x, star.y, 5);
        }}
      />
      <LockAuxIcon d={d} name="leaf" x={36} y={16.5} width={14} height={14} />
      <LockText d={d} text={lock.aqiValue === null ? "--" : String(Math.round(lock.aqiValue))} x={36} y={36.5} size={28} weight="semibold" maxWidth={50} />
      <LockText d={d} text={"AQI · " + (lock.aqiText ?? "--")} x={36} y={53.5} size={10.5} weight="semibold" maxWidth={46} />
    </>
  );
}

/** 06 风速风向：左上风线、右上风向箭头（指向风吹来的方向），中间「5级」，一道流线，下面风向 */
function WindStyle({ d, lock }: StyleProps) {
  const known = lock.windLevel !== null;
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          if (lock.windLevel !== null && lock.windLevel > 0) pen.arrow(50.5, 13.5, 10.5, lock.windAngle ?? 45);
          underline(pen, 36, 52, 50);
        }}
      />
      <LockAuxIcon d={d} name="breeze" x={25} y={13.5} width={17} height={14.2} />
      <LockNumberUnit d={d} x={36} y={36.7} number={known ? String(lock.windLevel) : "--"} unit={known ? "级" : ""} numberSize={28} unitSize={12} />
      <LockText d={d} text={lock.windDirection ?? "--"} x={36} y={61} size={11} alpha={0.95} maxWidth={40} />
    </>
  );
}

/** 07 降水概率：左上、右下两小段弧线，云雨图标、概率、「降水概率」和一颗小水滴。0% 也照常显示 */
function RainChanceStyle({ d, card, lock }: StyleProps) {
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          pen.fade(pen.arcPoints(36, 36, 31, 202, 244), 2.6, (t) => fadeOut(t));
          pen.fade(pen.arcPoints(36, 36, 31, 50, 100), 2.4, (t) => sweep(1 - t));
        }}
      />
      <LockWeatherIcon d={d} symbol={rainSymbol(card)} x={35.5} y={16} side={20} />
      <LockText d={d} text={lock.rainChance === null ? "--" : Math.round(lock.rainChance) + "%"} x={36} y={37} size={25} weight="semibold" maxWidth={48} />
      <LockText d={d} text="降水概率" x={36} y={52.5} size={10.5} alpha={0.95} />
      <LockAuxIcon d={d} name="probability_drop" x={61.5} y={52.5} width={5} height={6.9} />
    </>
  );
}

/**
 * 08 日出日落：日落（或日出）图标、时间、「日落」，下面一道太阳轨迹，
 * 圆点是白天已经过去的比例（夜里停在日出那一头）。
 */
function SunStyle({ d, lock }: StyleProps) {
  const sun = lock.sun;
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          // 太阳轨迹：设计稿 72×15 里的三次曲线，缩成 50 宽、中心在 (36, 59.5)，两头淡
          const k = 50 / 72;
          const map = (x0: number, y0: number): { x: number; y: number } => ({ x: 36 - 25 + x0 * k, y: 59.5 - 7.5 * k + y0 * k });
          const control = [
            map(3, 12),
            map(23, 2.5),
            map(49, 2.5),
            map(69, 12),
          ];
          pen.fade(pen.bezier(control[0], control[1], control[2], control[3]), 2.2, (t) => sweep(t));
          if (sun === null) return;
          const t = Math.max(0, Math.min(1, sun.progress));
          const u = 1 - t;
          const x =
            u * u * u * control[0].x + 3 * u * u * t * control[1].x + 3 * u * t * t * control[2].x + t * t * t * control[3].x;
          const y =
            u * u * u * control[0].y + 3 * u * u * t * control[1].y + 3 * u * t * t * control[2].y + t * t * t * control[3].y;
          pen.dot(x, y, 6);
        }}
      />
      <LockAuxIcon d={d} name={sun !== null && sun.label === "日出" ? "sunrise" : "sunset"} x={36} y={13} width={27} height={15.75} />
      <LockText d={d} text={sun === null ? "--" : sun.time} x={36} y={34.5} size={20} weight="semibold" maxWidth={54} />
      <LockText d={d} text={sun === null ? "日出日落" : sun.label} x={36} y={51.5} size={11} alpha={0.95} />
    </>
  );
}

// ---------------------------------------------------------------- 矩形（160×72）

/** 「实况与逐时」「实况与逐日」左边那一块：「现在」+ 天气图标、大温度、天气文字 */
function NowBlock({ d, card }: { d: LockDesign; card: Card }) {
  return (
    <>
      <LockText d={d} text="现在" x={0} y={10.5} size={11} alpha={0.85} align="leading" />
      <LockWeatherIcon d={d} symbol={card.condition.symbol} x={33} y={10.5} side={16} />
      <LockText d={d} text={card.temperature} x={24} y={36.5} size={30} weight="semibold" maxWidth={56} />
      <LockText d={d} text={card.condition.text} x={18} y={61.5} size={11} alpha={0.9} maxWidth={56} />
    </>
  );
}

/** 09 短临预报：图标「短临降水」，一句提示，下面两小时的降水曲线（没有数据的地方断开），底下「现在 1h 2h」 */
function NowcastStyle({ d, card, lock }: StyleProps) {
  const values = lock.minutelyRain;
  const headline = lock.rainOutlook ?? lock.keypoint ?? "暂无短临预报";
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          pen.line(
            [
              { x: 0, y: 53.5 },
              { x: 160, y: 53.5 },
            ],
            1.1,
            pen.white(0.36),
          );
          if (values === null || values.length < 2) return;
          let peak = 0;
          for (const value of values) if (value !== null && value > peak) peak = value;
          const upper = Math.max(peak, 1) * 1.05;
          const [top, bottom] = [37.5, 51.5];
          // 每 2 分钟取一个点画折线，没有数据的地方断开
          let segment: { x: number; y: number }[] = [];
          const flush = (): void => {
            if (segment.length > 1) pen.line(segment, 2.4, pen.white(), true);
            segment = [];
          };
          for (let index = 0; index < values.length; index += 2) {
            const value = values[index];
            if (value === null) {
              flush();
              continue;
            }
            segment.push({
              x: (index / (values.length - 1)) * 160,
              y: bottom - (Math.min(value, upper) / upper) * (bottom - top),
            });
          }
          flush();
        }}
      />
      <LockWeatherIcon d={d} symbol={rainSymbol(card)} x={8} y={9.5} side={17} />
      <LockText d={d} text="短临降水" x={20} y={9.5} size={12} alpha={0.85} align="leading" />
      <LockText d={d} text={headline} x={0} y={26.5} size={15.5} weight="semibold" align="leading" maxWidth={158} />
      <LockText d={d} text="现在" x={0} y={63} size={11} alpha={0.85} align="leading" />
      <LockText d={d} text="1h" x={80} y={63} size={11} alpha={0.85} />
      <LockText d={d} text="2h" x={160} y={63} size={11} alpha={0.85} align="trailing" />
    </>
  );
}

/** 雨量数字：整数直接写，小数保留一位（0.37 → 0.4），没有数据是 -- */
function rainText(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * 10 降雨量预报：图标「未来5小时」、单位，左边峰值，右边 5 根柱子（上面写雨量）。
 * 0 只在底线上画一小道，没有数据写 --、不画柱子。
 */
function RainfallStyle({ d, card, lock }: StyleProps) {
  const values: Array<number | null> = [];
  for (let index = 0; index < 5; index++) values.push(lock.hourlyRain?.[index] ?? null);
  const valid = values.filter((value): value is number => value !== null);
  const peak = valid.length > 0 ? Math.max(...valid) : null;
  const labels = ["现在", "1h", "2h", "3h", "4h"];
  const left = 31;
  const right = 160;
  const baseline = 53;
  const tallest = 18.5;
  const slot = (right - left) / values.length;
  const upper = Math.max(peak ?? 0, 0.5);
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          pen.line(
            [
              { x: left, y: baseline },
              { x: right, y: baseline },
            ],
            1.1,
            pen.white(0.36),
          );
          values.forEach((value, index) => {
            const center = left + slot * (index + 0.5);
            if (value === null) return;
            const height = value > 0 ? Math.max(2, (Math.min(value, upper) / upper) * tallest) : 0;
            if (height > 0) pen.bar(center, baseline, 16, height);
            else pen.capsule(center - 6.5, baseline - 2.4, 13, 2.4, pen.white(0.85));
          });
        }}
      />
      <LockWeatherIcon d={d} symbol={peak !== null && peak > 0 ? rainSymbol(card) : card.condition.symbol} x={8} y={9.5} side={17} />
      <LockText d={d} text="未来5小时" x={20} y={9.5} size={12.5} weight="semibold" align="leading" />
      <LockText d={d} text="mm/h" x={160} y={9.5} size={11} alpha={0.75} align="trailing" />
      <LockText d={d} text="峰值" x={0} y={27} size={11} alpha={0.85} align="leading" />
      <LockText d={d} text={rainText(peak)} x={0} y={40.5} size={17} weight="semibold" align="leading" maxWidth={28} />
      {values.map((_, index) => (
        <LockText d={d} text={labels[index]} x={left + slot * (index + 0.5)} y={63} size={11} alpha={0.85} />
      ))}
      {values.map((value, index) => {
        const height = value === null || value <= 0 ? 0 : Math.max(2, (Math.min(value, upper) / upper) * tallest);
        return (
          <LockText
            d={d}
            text={rainText(value)}
            x={left + slot * (index + 0.5)}
            y={baseline - height - 6.5}
            size={11.5}
            weight="semibold"
          />
        );
      })}
    </>
  );
}

/** 11 实况与逐时：左边「现在」+ 天气图标、大温度、天气文字；右边接下来三个小时的钟点、图标、温度，下面一道流线 */
function CurrentHourlyStyle({ d, card, lock }: StyleProps) {
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          const k = (160 - 66) / 88;
          const map = (x0: number, y0: number): { x: number; y: number } => ({ x: 66 + (x0 - 2) * k, y: 59 + (y0 - 6) * k });
          pen.fade(pen.bezier(map(2, 6), map(28, -1), map(60, 15), map(90, 4)), 2.2, (t) => sweep(t));
        }}
      />
      <NowBlock d={d} card={card} />
      {lock.nextHours.map((hour, index) => (
        <LockText d={d} text={hour.label} x={80 + index * 33} y={10.5} size={11} alpha={0.85} />
      ))}
      {lock.nextHours.map((hour, index) =>
        hour.symbol === null ? null : (
          <LockWeatherIcon d={d} symbol={hour.symbol} x={80 + index * 33} y={27.5} side={15} />
        ),
      )}
      {lock.nextHours.map((hour, index) => (
        <LockText d={d} text={hour.temperature} x={80 + index * 33} y={45} size={14} weight="semibold" maxWidth={30} />
      ))}
    </>
  );
}

/**
 * 12 风与湿度：左边风线「风力」、大字「5级」、一道流线、风向箭头和「东北风」（箭头指向风吹来的方向）；
 * 右边水滴「湿度」、大字「64%」、湿度条（亮的长度 = 湿度 / 100）。
 * 0 级风写「无风」、不画箭头；湿度没有数据时写 --、只画灰色底条（不当成 0%）。
 */
function WindHumidityStyle({ d, lock }: StyleProps) {
  const level = lock.windLevel;
  const humidity = lock.humidity;
  const humidityKnown = humidity !== null && Number.isFinite(humidity);
  return (
    <>
      <LockCanvas
        d={d}
        draw={(pen) => {
          underline(pen, 36, 50.5, 66, 2.2);
          if (level !== null && level > 0) pen.arrow(5.5, 62, 9.5, lock.windAngle ?? 45);
          // 湿度条：灰色底条铺满这一列，亮色从左边按湿度比例画（0% 不画亮色）
          const [barY, barHeight] = [55.5, 3.2];
          pen.capsule(90, barY - barHeight / 2, 70, barHeight, pen.gray());
          if (humidityKnown && humidity > 0) {
            pen.capsule(90, barY - barHeight / 2, (70 * Math.min(100, humidity)) / 100, barHeight, pen.white());
          }
        }}
      />
      <LockAuxIcon d={d} name="breeze" x={9} y={10.5} width={18} height={15} />
      <LockText d={d} text="风力" x={21} y={10.5} size={11} alpha={0.85} align="leading" />
      <LockNumberUnit d={d} x={36} y={32} number={level === null ? "--" : String(level)} unit={level === null ? "" : "级"} numberSize={30} unitSize={13} />
      {level !== null && level > 0 ? (
        <LockText d={d} text={lock.windDirection ?? "--"} x={13.5} y={62} size={11} alpha={0.95} align="leading" maxWidth={58} />
      ) : (
        <LockText d={d} text={level === null ? "--" : "无风"} x={0} y={62} size={11} alpha={0.95} align="leading" />
      )}
      <LockAuxIcon d={d} name="probability_drop" x={93.5} y={10.5} width={11} height={15} />
      <LockText d={d} text="湿度" x={100.5} y={10.5} size={11} alpha={0.85} align="leading" />
      <LockLongNumber d={d} x={89.5} y={32} number={humidityKnown ? String(humidity) : "--"} unit={humidityKnown ? "%" : ""} numberSize={30} unitSize={17} />
    </>
  );
}

/**
 * 13 实况与逐日：左边和「实况与逐时」一样（「现在」+ 天气图标、大温度、天气文字）；
 * 右边明天起三天的星期、图标、最高温，最低温淡一点写在最下面，和左边的天气文字一行。
 */
function CurrentDailyStyle({ d, card, lock }: StyleProps) {
  return (
    <>
      <NowBlock d={d} card={card} />
      {lock.nextDays.map((day, index) => (
        <LockText d={d} text={day.label} x={80 + index * 33} y={10.5} size={11} alpha={0.85} />
      ))}
      {lock.nextDays.map((day, index) =>
        day.symbol === null ? null : (
          <LockWeatherIcon d={d} symbol={day.symbol} x={80 + index * 33} y={27.5} side={15} />
        ),
      )}
      {lock.nextDays.map((day, index) => (
        <LockText d={d} text={day.high} x={80 + index * 33} y={45} size={14} weight="semibold" maxWidth={30} />
      ))}
      {lock.nextDays.map((day, index) => (
        <LockText d={d} text={day.low} x={80 + index * 33} y={61.5} size={11} alpha={0.6} maxWidth={30} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- 选款

/** 13 款的画法：按 core/lock.ts 的 value 找；不存在的话退回这种形状的第一款 */
const FACES: Record<string, (props: StyleProps) => VirtualNode> = {
  current: CurrentStyle,
  highLow: HighLowStyle,
  uv: UvStyle,
  aqiArc: AqiArcStyle,
  aqiOrbit: AqiOrbitStyle,
  wind: WindStyle,
  rainChance: RainChanceStyle,
  sun: SunStyle,
  nowcast: NowcastStyle,
  rainfall: RainfallStyle,
  currentHourly: CurrentHourlyStyle,
  windHumidity: WindHumidityStyle,
  currentDaily: CurrentDailyStyle,
};

const FALLBACK: Record<LockFamilyKey, string> = { circle: "current", rect: "nowcast" };

/** 锁屏组件的外壳：按组件大小摆好一块，整块可点（点一下打开 App，由外面的 widgetURL 管） */
export function LockFace({
  family,
  style,
  d,
  card,
  lock,
  tapURL,
}: {
  family: LockFamilyKey;
  style: LockStyle;
  d: LockDesign;
  card: Card;
  lock: LockView;
  tapURL: string | undefined;
}): VirtualNode {
  const face = FACES[style.value] ?? FACES[FALLBACK[family]];
  return (
    <ZStack frame={{ width: d.width, height: d.height }} widgetURL={tapURL}>
      {face({ d, card, lock })}
    </ZStack>
  );
}
