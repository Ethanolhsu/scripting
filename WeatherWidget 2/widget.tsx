// 天气小组件的入口：定位置 → 取天气（缓存还新就不联网）→ 整理成要说的话 → 画出来 → 约好下次重画的时间。
//
// 小组件是一次性渲染：`Widget.present` 一返回，这段上下文就没了，所以要算的都在它之前算完。
// 在小组件里联网、定位、反查城市名，文档都没明说能不能用，所以每一步都有退路（见 core/load.ts）：
// 定位不成用上次存下的位置，联网不成用缓存，缓存也没有就画一张说人话的卡片，不留空白。
//
// 授权不在这里要：小组件里弹不了框。定位的授权由 App 页（index.tsx）去要。

import { Script, Text, Widget, ZStack } from "scripting";
import type { AlertState } from "./core/alertState";
import { loadEverything } from "./core/everything";
import { familyOf } from "./core/layout";
import type { Loaded } from "./core/load";
import { resolveLockStyle } from "./core/lock";
import { present } from "./core/present";
import { nextReloadAt } from "./core/schedule";
import { parseParameter } from "./core/settings";
import { loadDisplay, loadSettings } from "./core/store";
import { systemDeps } from "./core/system";
import { WidgetView } from "./widget/view";

/** 读不到实际尺寸时按小号的常见点数兜底，免得把卡片缩成 0；锁屏按系统给的常见点数兜底（圆形 72、矩形 158×72） */
function displaySize(family: string): { width: number; height: number } {
  const size = Widget.displaySize;
  const fallback =
    family === "accessoryCircular"
      ? { width: 72, height: 72 }
      : family === "accessoryRectangular"
        ? { width: 158, height: 72 }
        : { width: 158, height: 158 };
  return {
    width: size !== undefined && size.width > 0 ? size.width : fallback.width,
    height: size !== undefined && size.height > 0 ? size.height : fallback.height,
  };
}

/** 点一下小组件：打开本脚本（App 页里有完整的天气和设置） */
function tapURL(): string | undefined {
  try {
    // 读不到脚本名时别拼出 scripting://run/undefined：点了只会打不开
    return typeof Script.name === "string" && Script.name !== "" ? Script.createRunURLScheme(Script.name) : undefined;
  } catch {
    return undefined;
  }
}

async function run(): Promise<void> {
  const family = Widget.family;
  const { width, height } = displaySize(family);
  const size = familyOf(family, width, height) === "large" ? "large" : "compact";
  const settings = loadSettings();
  // 锁屏画哪一款：组件参数里填了这种形状的编号 / 名字就用它，否则用 App 页「锁屏样式」里的默认款
  const lockStyle = resolveLockStyle(family === "accessoryRectangular" ? "rect" : "circle", settings, Widget.parameter);

  let loaded: Loaded;
  let alerts: AlertState;
  try {
    // 天气、详细数据和预警（默认用内置接口，也可以换成自己的、或者备用的 Open-Meteo）是同一次请求，见 core/everything.ts
    ({ weather: loaded, alerts } = await loadEverything(systemDeps("widget"), {
      settings,
      parameter: parseParameter(Widget.parameter),
      force: false,
    }));
  } catch {
    // 走到这里是意料之外的错（load.ts 里已经把定位、联网、反查各自兜住了）；画「暂时取不到」，下次早点再来
    loaded = { kind: "noData", source: "live", place: null, failure: null };
    alerts = { kind: "off" };
  }

  // 「现在」要等查完再读：预警记下的「取到的时刻」是联网那一刻，比开头读的时钟晚，先读的话会被当成「在未来」而藏起来
  const now = Date.now();
  Widget.present(
    <WidgetView
      family={family}
      width={width}
      height={height}
      content={present(loaded, now, size, alerts, loadDisplay())}
      lockStyle={lockStyle}
      tapURL={tapURL()}
    />,
    { policy: "after", date: new Date(nextReloadAt(loaded, now)) },
  );
}

run().catch((error: unknown) => {
  // 画一张说「出错了」的卡，总比一片空白强。
  Widget.present(
    <ZStack widgetBackground="#2C2C2E" padding={12}>
      <Text font="caption" foregroundStyle="#FFFFFF" lineLimit={3}>
        {"天气小组件出错了\n" + String(error).slice(0, 120)}
      </Text>
    </ZStack>,
  );
});
