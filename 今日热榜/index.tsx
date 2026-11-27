// 今日热榜 · 设置页（Scripting App，index.tsx）
// 原项目的设置是在 Scriptable 里用 WebView 打开一个网页来管的，这里换成原生 SwiftUI 列表：
// 添加/移除榜单、常用榜单、条数与配色。设置写入 App Group，组件进程读得到。

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
import {
  BUILTIN_BOARDS,
  decodeHtml,
  loadBoardData,
  loadSettings,
  parseBoardId,
  saveSettings,
  type Board,
  type Settings,
  type Style,
} from "./shared"

function SettingsApp() {
  const [settings, setSettings] = useState<Settings>(loadSettings())
  const [input, setInput] = useState("")
  const [message, setMessage] = useState("")

  const commit = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }

  const patchStyle = (part: Partial<Style>) => {
    commit({ ...settings, style: { ...settings.style, ...part } })
  }

  const hasBoard = (id: string) => settings.boards.some((b) => b.id === id)

  const addBoard = async (id: string) => {
    if (hasBoard(id)) {
      setMessage("这个榜单已经在列表里了")
      return
    }
    setMessage("正在解析榜单…")
    try {
      const data = await loadBoardData(id)
      const name = decodeHtml(data.title) || id
      const board: Board = { id, name, icon: data.logo }
      const next: Settings = { ...settings, boards: [...settings.boards, board] }
      commit(next)
      setMessage(`已添加：${name}`)
    } catch (error) {
      setMessage("解析失败，检查链接或网络后重试")
      console.log(error)
    }
  }

  const addFromInput = async () => {
    const text = input.trim()
    if (!text) return
    const parsed = parseBoardId(text)
    if (!parsed) {
      setMessage("请输入 tophub.today/n/xxxx 这样的链接，或 8~12 位榜单 ID")
      return
    }
    await addBoard(parsed.id)
    setInput("")
  }

  const removeBoard = (id: string) => {
    const boards = settings.boards.filter((b) => b.id !== id)
    commit({ ...settings, boards, cursor: Math.min(settings.cursor, boards.length - 1) })
    setMessage("已移除")
  }

  const numberField = (title: string, value: number, onChange: (value: number) => void) => (
    <TextField
      title={title}
      value={`${value}`}
      onChanged={(text) => {
        const num = Number(text)
        if (Number.isFinite(num) && num > 0) onChange(num)
      }}
    />
  )

  const style = settings.style

  return (
    <NavigationStack>
      <List navigationTitle="今日热榜">
        <Section>
          <VStack alignment="leading" spacing={4}>
            <Text font={13} foregroundStyle="secondary">
              在桌面长按 → 添加 Scripting 组件 → 选择「今日热榜」。Parameter 填榜单名（如「微博」）可固定显示，留空则每次刷新按列表顺序轮换。
            </Text>
            <Button
              title="刷新所有组件"
              action={async () => {
                await Widget.reloadAll()
                setMessage("已请求刷新组件")
              }}
            />
          </VStack>
        </Section>

        <Section>
          <Text font={15} fontWeight="semibold">
            已添加的榜单（{settings.boards.length}）
          </Text>
          {settings.boards.length === 0 ? (
            <Text font={13} foregroundStyle="secondary">
              还没有添加，默认显示微博热搜。可以在下面从常用榜单里选，或粘贴链接添加。
            </Text>
          ) : null}
          {settings.boards.map((board) => (
            <HStack spacing={8}>
              <Text font={14} lineLimit={1} layoutPriority={1}>
                {board.name}
              </Text>
              <Spacer />
              <Button title="移除" action={() => removeBoard(board.id)} />
            </HStack>
          ))}
        </Section>

        <Section>
          <Text font={15} fontWeight="semibold">
            添加榜单
          </Text>
          <TextField
            title="链接或 ID"
            value={input}
            onChanged={setInput}
            prompt="https://tophub.today/n/KqndgxeLl9"
          />
          <Button title="添加" action={addFromInput} />
          {message ? (
            <Text font={13} foregroundStyle="secondary">
              {message}
            </Text>
          ) : null}
        </Section>

        <Section>
          <Text font={15} fontWeight="semibold">
            常用榜单
          </Text>
          {BUILTIN_BOARDS.map((board) => (
            <HStack spacing={8}>
              <Text font={14} lineLimit={1} layoutPriority={1}>
                {board.name}
              </Text>
              <Spacer />
              {hasBoard(board.id) ? (
                <Text font={12} foregroundStyle="secondary">
                  已添加
                </Text>
              ) : (
                <Button title="添加" action={() => addBoard(board.id)} />
              )}
            </HStack>
          ))}
        </Section>

        <Section>
          <Text font={15} fontWeight="semibold">
            每个尺寸显示几条
          </Text>
          {numberField("小尺寸", style.smallCount, (v) => patchStyle({ smallCount: v }))}
          {numberField("中尺寸", style.mediumCount, (v) => patchStyle({ mediumCount: v }))}
          {numberField("大尺寸", style.largeCount, (v) => patchStyle({ largeCount: v }))}
        </Section>

        <Section>
          <Text font={15} fontWeight="semibold">
            字号与行距
          </Text>
          {numberField("榜单名字号", style.titleFontSize, (v) => patchStyle({ titleFontSize: v }))}
          {numberField("正文与序号字号", style.contentFontSize, (v) => patchStyle({ contentFontSize: v }))}
          {numberField("行距", Math.max(0, style.lineSpacing), (v) => patchStyle({ lineSpacing: v }))}
        </Section>

        <Section>
          <Text font={15} fontWeight="semibold">
            配色（#RRGGBB，留空跟随深色模式）
          </Text>
          <TextField
            title="前三名序号"
            value={style.hotColor}
            onChanged={(v) => patchStyle({ hotColor: v.trim() })}
            prompt="#EF233C"
          />
          <TextField
            title="榜单名颜色"
            value={style.titleColor}
            onChanged={(v) => patchStyle({ titleColor: v.trim() })}
            prompt="留空自动"
          />
          <TextField
            title="正文颜色"
            value={style.contentColor}
            onChanged={(v) => patchStyle({ contentColor: v.trim() })}
            prompt="留空自动"
          />
        </Section>

        <Section>
          <HStack>
            <Text>显示榜单名与图标</Text>
            <Spacer />
            <Button
              title={style.showTitle ? "开" : "关"}
              action={() => patchStyle({ showTitle: !style.showTitle })}
            />
          </HStack>
          <HStack>
            <Text>显示刷新时间（中/大尺寸）</Text>
            <Spacer />
            <Button
              title={style.showRefresh ? "开" : "关"}
              action={() => patchStyle({ showRefresh: !style.showRefresh })}
            />
          </HStack>
        </Section>

        <Section>
          <Text font={13} foregroundStyle="secondary">
            数据来自 tophub.today，组件每 60 分钟请求刷新一次；同一榜单 10 分钟内读缓存，断网时用上次的数据。
          </Text>
        </Section>
      </List>
    </NavigationStack>
  )
}

async function main() {
  await Navigation.present(<SettingsApp />)
  Script.exit()
}

main()
