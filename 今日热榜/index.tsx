// 在 App 里打开脚本时的页面：管榜单、调条数和字号、改配色、预览组件。
// 原 Scriptable 版是在 WebView 里开一个网页来管这些的，这里换成原生列表。
// 设置写进 Storage，小组件进程读得到；改完顺手让主屏幕上的组件重画。

import {
  Button,
  HStack,
  List,
  Navigation,
  NavigationStack,
  Script,
  Section,
  Spacer,
  Text,
  TextField,
  VStack,
  Widget,
  useState,
} from "scripting"
import { BUILTIN_BOARDS, loadSettings, saveSettings, clearCaches, type Board, type Hex, type Settings, type Style } from "./core/store"
import { loadBoard, parseBoardId } from "./core/tophub"

function Row({ title, value }: { title: string; value: string }) {
  return (
    <HStack>
      <Text>{title}</Text>
      <Spacer />
      <Text foregroundStyle="secondaryLabel" lineLimit={1}>
        {value}
      </Text>
    </HStack>
  )
}

function ToggleRow({ title, on, onChange }: { title: string; on: boolean; onChange: (next: boolean) => void }) {
  return (
    <Button action={() => onChange(!on)}>
      <HStack>
        <Text>{title}</Text>
        <Spacer />
        <Text foregroundStyle={on ? "systemBlue" : "secondaryLabel"}>{on ? "开" : "关"}</Text>
      </HStack>
    </Button>
  )
}

const HELP =
  "长按主屏幕空白处 → 点左上角加号 → 找到 Scripting 添加组件 → 长按组件「编辑组件」→ 脚本选「今日热榜」。\n\n点一下组件会打开本页。\n\n想固定看某个榜：在组件的「参数」里填榜单名（如 知乎）或榜单 ID；留空则每次刷新按下面顺序轮换。\n\n小组件取数会被站点「安全验证」偶尔拦一下，拦了就显示上一次的数据；连续取不到时点开本页按「立即刷新」试试。"

function App() {
  const dismiss = Navigation.useDismiss()
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const style = settings.style

  const commit = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }

  const patchStyle = (part: Partial<Style>) => {
    commit({ ...settings, style: { ...settings.style, ...part } })
  }

  const hasBoard = (id: string) => settings.boards.some((board) => board.id === id)

  async function addBoard(id: string): Promise<void> {
    if (hasBoard(id)) {
      await Dialog.alert({ message: "这个榜单已经在列表里了" })
      return
    }
    setBusy(true)
    try {
      const data = await loadBoard(id, true)
      const builtin = BUILTIN_BOARDS.find((board) => board.id === id)
      const name = data.title.trim() !== "" ? data.title.trim() : builtin?.name ?? id
      const board: Board = { id, name, icon: data.logo || builtin?.icon || "" }
      const next: Settings = { ...settings, boards: [...settings.boards, board] }
      commit(next)
      Widget.reloadAll()
    } catch (error) {
      await Dialog.alert({
        message: "这个榜单没取到：\n" + String(error).slice(0, 120) + "\n\n检查一下链接是不是 tophub.today/n/… 这种，或者站点正在安全验证，稍后再试",
      })
    } finally {
      setBusy(false)
    }
  }

  async function addFromInput(): Promise<void> {
    const parsed = parseBoardId(input)
    if (parsed === null) {
      await Dialog.alert({ message: "填 tophub.today/n/xxxx 这样的链接，或者 8~12 位的榜单 ID" })
      return
    }
    setInput("")
    await addBoard(parsed.id)
  }

  function removeBoard(id: string): void {
    const boards = settings.boards.filter((board) => board.id !== id)
    commit({ ...settings, boards, cursor: Math.min(settings.cursor, boards.length - 1) })
    Widget.reloadAll()
  }

  async function preview(): Promise<void> {
    try {
      await Widget.preview({ family: "systemMedium" })
    } catch (error) {
      await Dialog.alert({ message: "预览打不开：" + String(error).slice(0, 100) })
    }
  }

  async function clearCache(): Promise<void> {
    const ok = await Dialog.confirm({ title: "清空缓存？", message: "已经取到的榜单内容会删掉，下次刷新重新取。榜单和样式不动。", confirmLabel: "清空" })
    if (!ok) return
    clearCaches()
    await Dialog.alert({ message: "已清空，稍后小组件会重新取数" })
  }

  function numberField(title: string, value: number, low: number, high: number, onChange: (next: number) => void) {
    return (
      <TextField
        title={title}
        value={`${value}`}
        onChanged={(text) => {
          const num = Number(text)
          if (text.trim() !== "" && Number.isFinite(num) && num >= low && num <= high) onChange(num)
        }}
      />
    )
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="今日热榜"
        navigationBarTitleDisplayMode="inline"
        toolbar={{ cancellationAction: <Button title="退出" action={() => dismiss()} /> }}
      >
        <Section footer={<Text>{HELP}</Text>}>
          <Row title="已添加的榜单" value={`${settings.boards.length} 个`} />
          <Button action={() => void preview()}>
            <Text foregroundStyle="systemBlue">预览中号组件</Text>
          </Button>
          <Button
            action={() => {
              Widget.reloadAll()
            }}
          >
            <Text foregroundStyle="systemBlue">立即刷新主屏幕组件</Text>
          </Button>
        </Section>

        <Section header={<Text>榜单</Text>}>
          {settings.boards.length === 0 ? <Text foregroundStyle="secondaryLabel">还没添加，默认显示微博热搜</Text> : null}
          {settings.boards.map((board) => (
            <HStack key={board.id}>
              <VStack alignment="leading" spacing={2}>
                <Text lineLimit={1}>{board.name}</Text>
                <Text font={11} foregroundStyle="secondaryLabel" lineLimit={1}>
                  {board.id}
                </Text>
              </VStack>
              <Spacer />
              <Button action={() => removeBoard(board.id)}>
                <Text foregroundStyle="systemRed">移除</Text>
              </Button>
            </HStack>
          ))}
          <TextField
            title="链接或 ID"
            value={input}
            prompt="https://tophub.today/n/KqndgxeLl9"
            onChanged={setInput}
          />
          <Button action={() => void addFromInput()}>
            <Text foregroundStyle={busy || input.trim() === "" ? "secondaryLabel" : "systemBlue"}>
              {busy ? "正在取榜单…" : "添加"}
            </Text>
          </Button>
        </Section>

        <Section header={<Text>常用榜单</Text>} footer={<Text>点「添加」会先取一次页面，取到名字和图标再存下来。</Text>}>
          {BUILTIN_BOARDS.map((board) => (
            <HStack key={board.id}>
              <Text lineLimit={1} layoutPriority={1}>
                {board.name}
              </Text>
              <Spacer />
              {hasBoard(board.id) ? (
                <Text font={12} foregroundStyle="secondaryLabel">
                  已添加
                </Text>
              ) : (
                <Button action={() => void addBoard(board.id)}>
                  <Text foregroundStyle={busy ? "secondaryLabel" : "systemBlue"}>添加</Text>
                </Button>
              )}
            </HStack>
          ))}
        </Section>

        <Section header={<Text>条数</Text>} footer={<Text>大号别超过 14 条，组件内存只有 30MB 左右。</Text>}>
          {numberField("小号", style.smallCount, 1, 8, (next) => patchStyle({ smallCount: next }))}
          {numberField("中号", style.mediumCount, 1, 8, (next) => patchStyle({ mediumCount: next }))}
          {numberField("大号", style.largeCount, 1, 20, (next) => patchStyle({ largeCount: next }))}
        </Section>

        <Section header={<Text>字号与行距</Text>} footer={<Text>这里填的是中号的基准，小号会自动小一点、大号大一点，再按实际组件尺寸缩放。</Text>}>
          {numberField("榜单名字号", style.titleSize, 10, 22, (next) => patchStyle({ titleSize: next }))}
          {numberField("正文与序号字号", style.contentSize, 9, 18, (next) => patchStyle({ contentSize: next }))}
          {numberField("行距", style.lineSpacing, 0, 12, (next) => patchStyle({ lineSpacing: next }))}
        </Section>

        <Section header={<Text>外观</Text>} footer={<Text>两个背景分别给浅色、深色模式用；文字颜色按背景亮度自动选（浅底黑字、深底白字）。</Text>}>
          <TextField
            title="浅色模式背景"
            value={style.backgroundLight}
            prompt="#FFFFFF"
            onChanged={(text) => patchStyle({ backgroundLight: text.trim() as Hex })}
          />
          <TextField
            title="深色模式背景"
            value={style.backgroundDark}
            prompt="#151517"
            onChanged={(text) => patchStyle({ backgroundDark: text.trim() as Hex })}
          />
          <TextField title="前三名颜色" value={style.hotColor} prompt="#EF233C" onChanged={(text) => patchStyle({ hotColor: text.trim() as Hex })} />
          <ToggleRow title="显示榜单名与图标" on={style.showTitle} onChange={(next) => patchStyle({ showTitle: next })} />
          <ToggleRow title="显示刷新时间（中/大号）" on={style.showRefresh} onChange={(next) => patchStyle({ showRefresh: next })} />
          <Button
            action={() => {
              Widget.reloadAll()
            }}
          >
            <Text foregroundStyle="systemBlue">保存样式并刷新组件</Text>
          </Button>
        </Section>

        <Section footer={<Text>数据来自 tophub.today。组件每小时请求一次刷新，同一个榜单 10 分钟内读缓存。</Text>}>
          <Button action={() => void clearCache()}>
            <Text foregroundStyle="systemRed">清空缓存</Text>
          </Button>
        </Section>
      </List>
    </NavigationStack>
  )
}

async function run(): Promise<void> {
  await Navigation.present({ element: <App />, modalPresentationStyle: "fullScreen" })
  Script.exit()
}

void run()
