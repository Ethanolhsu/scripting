// App 设置页：选文字颜色、选节假日日历、看今天的预览。
// 日历权限只能在 App 里弹，所以第一次使用请点「读取日历列表」授权；小组件那边不会弹框。
// 颜色是十六进制字符串，日期、星期、短句、牌子边框都跟随它；插画保持黑白线稿。

import {
  Button,
  ColorPicker,
  RoundedRectangle,
  HStack,
  List,
  Navigation,
  NavigationStack,
  Picker,
  Script,
  Section,
  Text,
  VStack,
  Widget,
  ZStack,
  useEffect,
  useRef,
  useState,
  type Color,
} from "scripting";
import { baseState, resolveToday, type DayState } from "./core/dayState";
import { listEventCalendars, type CalendarOption } from "./core/holiday";
import { defaultSettings, DEFAULT_CALENDAR_TITLE, isLightColor, type Settings } from "./core/settings";
import { loadSettings, saveSettings } from "./core/store";
import { SmallDay } from "./widget/SmallDay";

function tapURL(): string | undefined {
  try {
    return typeof Script.name === "string" && Script.name !== "" ? Script.createRunURLScheme(Script.name) : undefined;
  } catch {
    return undefined;
  }
}

function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [preview, setPreview] = useState<DayState>(baseState(new Date()));
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const reloadTimer = useRef<number | null>(null);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    if (reloadTimer.current !== null) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      reloadTimer.current = null;
      Widget.reloadAll();
    }, 500);
  };

  const refreshPreview = () => {
    resolveToday(settings, new Date())
      .then((state) => setPreview(state))
      .catch(() => setPreview(baseState(new Date())));
  };

  useEffect(() => {
    refreshPreview();
  }, [settings.calendarID, settings.calendarTitle]);

  const loadCalendars = async () => {
    setBusy(true);
    setMessage("");
    try {
      const granted = await Script.requestAccess(["calendar"]);
      if (!granted.includes("calendar")) {
        setMessage("没有拿到日历权限。请到「设置 → 隐私与安全性 → 日历」里允许 Scripting 读取。");
        return;
      }
      const list = await listEventCalendars();
      setCalendars(list);
      if (list.length === 0) {
        setMessage("系统里没有可用的日历。请先在「日历」App 里添加节假日日历（比如订阅的「中国大陆节假日」）。");
        return;
      }
      const guess = list.find((item) => item.title === DEFAULT_CALENDAR_TITLE) ?? list.find((item) => item.title.includes("节假日"));
      if (settings.calendarID === "" && guess !== undefined) {
        update({ calendarID: guess.id, calendarTitle: guess.title });
        setMessage(`已选「${guess.title}」。如果不是这个日历，在下面换一个。`);
      } else {
        setMessage(`读到 ${list.length} 个日历，选一个只放节假日/调休的。`);
      }
    } catch (error) {
      setMessage("读取失败：" + String(error).slice(0, 120));
    } finally {
      setBusy(false);
      refreshPreview();
    }
  };

  const chooseCalendar = (id: string) => {
    const picked = calendars.find((item) => item.id === id);
    if (picked === undefined) {
      update({ calendarID: "", calendarTitle: DEFAULT_CALENDAR_TITLE });
      return;
    }
    update({ calendarID: picked.id, calendarTitle: picked.title });
  };

  return (
    <NavigationStack>
      <List>
        <Section footer={<Text font="footnote">日期、星期、短句和牌子边框都用这个颜色；插画是黑白线稿，不会被染色。牌子底色会自动反着来，保证字看得清。</Text>}>
          <ColorPicker
            title="文字与线框颜色"
            value={settings.color as Color}
            supportsOpacity={false}
            onChanged={(value) => update({ color: value })}
          />
        </Section>

        <Section title="今天的样子">
          <ZStack frame={{ width: 178, height: 178 }} alignment="center">
            <RoundedRectangle cornerRadius={18} fill={isLightColor(settings.color) ? "#2A2A2E" : "#EFE7D6"} />
            <SmallDay state={preview} color={settings.color as Color} tapURL={tapURL()} />
          </ZStack>
          <HStack spacing={8}>
            <Text font="footnote" foregroundStyle="secondaryLabel">
              {preview.date} {preview.weekday}
            </Text>
            <Text font="footnote" foregroundStyle="secondaryLabel">
              {preview.kind === "holiday"
                ? "法定节假日"
                : preview.kind === "makeup"
                  ? "调休补班"
                  : preview.kind === "weekend"
                    ? "周末"
                    : "工作日"}
            </Text>
          </HStack>
        </Section>

        <Section footer={<Text font="footnote">只读你选中的这一个日历里的「全天事件」。标题含 补班/上班/调休/补课/值班 判为补班，其余判为法定节假日；没选日历或当天没事件时，按普通工作日/周末画。</Text>}>
          <Text font="subheadline">当前日历：{settings.calendarTitle}</Text>
          <Button action={() => void loadCalendars()} disabled={busy}>
            <Text foregroundStyle={busy ? "secondaryLabel" : "systemBlue"}>
              {busy ? "正在读取…" : calendars.length === 0 ? "授权并读取日历列表" : "重新读取日历列表"}
            </Text>
          </Button>
          {calendars.length > 0 ? (
            <Picker title="节假日日历" value={settings.calendarID} onChanged={chooseCalendar}>
              <Text tag="">未选择（按星期判断）</Text>
              {calendars.map((item) => (
                <Text key={item.id} tag={item.id}>
                  {item.title}
                </Text>
              ))}
            </Picker>
          ) : null}
          {message !== "" ? (
            <Text font="footnote" foregroundStyle="secondaryLabel">
              {message}
            </Text>
          ) : null}
        </Section>

        <Section footer={<Text font="footnote">组件本体用透明背景；第一次加到桌面后，还要在 Scripting 的组件设置里打开「透明背景」，壁纸才会真正透出来。iOS 读不到壁纸亮度，所以颜色请自己选。</Text>}>
          <Text font="footnote" foregroundStyle="secondaryLabel">
            只做 2×2 小号。点击组件会回到这个设置页。
          </Text>
        </Section>

        <Section>
          <Button
            role="destructive"
            action={() => {
              update(defaultSettings());
              setMessage("");
            }}
          >
            <Text foregroundStyle="systemRed">恢复默认（黑字 + 中国大陆节假日）</Text>
          </Button>
        </Section>
      </List>
    </NavigationStack>
  );
}

async function run(): Promise<void> {
  await Navigation.present({ element: <App />, modalPresentationStyle: "fullScreen" });
  Script.exit();
}

void run();
