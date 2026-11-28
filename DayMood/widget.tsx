// 小组件入口：读设置 → 读当天状态（系统日历 → 缓存 → 普通工作日）→ 画 2×2 → 约到次日 00:05 重画。
// 日历授权不在小组件里弹：首次请在 App 页点「读取日历列表」授权；没授权也能按工作日/周末正常出图。

import { Script, Text, Widget, ZStack, type Color } from "scripting";
import { nextMidnight } from "./core/date";
import { resolveToday } from "./core/dayState";
import { loadSettings } from "./core/store";
import { SmallDay } from "./widget/SmallDay";

function tapURL(): string | undefined {
  try {
    return typeof Script.name === "string" && Script.name !== ""
      ? Script.createRunURLScheme(Script.name)
      : undefined;
  } catch {
    return undefined;
  }
}

async function run(): Promise<void> {
  const settings = loadSettings();
  const now = new Date();
  const state = await resolveToday(settings, now);
  const size = Widget.displaySize;
  const width = size !== undefined && size.width > 0 ? size.width : 158;
  const height = size !== undefined && size.height > 0 ? size.height : 158;

  Widget.present(
    <ZStack widgetBackground="clear" frame={{ width, height }} alignment="center">
      <SmallDay state={state} color={settings.color as Color} tapURL={tapURL()} />
    </ZStack>,
    { policy: "after", date: nextMidnight(now) },
  );
}

run().catch((error: unknown) => {
  Widget.present(
    <ZStack widgetBackground="clear" frame={{ width: 158, height: 158 }} padding={14} alignment="leading">
      <Text font={10} foregroundStyle="#8A8A8E" lineLimit={4}>
        {"打工人日历出错了\n" + String(error).slice(0, 100)}
      </Text>
    </ZStack>,
  );
});
