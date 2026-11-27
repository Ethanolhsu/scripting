# 今日热榜 · Scripting App 版

把原 Scriptable 项目「今日热榜」移植到 [Scripting App](https://apps.apple.com/app/id6479691128)。项目结构照 [Ethanolhsu/scripting 的 WeatherWidget](https://github.com/Ethanolhsu/scripting/tree/main/WeatherWidget) 来：`script.json` + `index.tsx` + `widget.tsx` + `core/` + `widget/`，配置走 `Storage`，组件页面按 `Widget.displaySize` 自己撑满。

## 目录结构

```
今日热榜-Scripting/
├─ script.json       # 脚本元数据（名字、图标、入口）
├─ index.tsx         # App 里的设置页
├─ widget.tsx        # 小组件入口：取数 → 算版面 → Widget.present
├─ core/
│  ├─ store.ts       # Storage 设置 / 缓存读写（App 与组件共用）
│  ├─ tophub.ts      # 抓页面 + 解析 + 10 分钟缓存 + 被拦时回退
│  └─ layout.ts      # 按尺寸算字号、行距、内缩、条数、轮换
└─ widget/
   └─ view.tsx       # 组件画面（背景、头部、条目）
```

## 安装

1. 在 Scripting 里新建脚本，把上面这些文件按同样的目录放进去（`core/`、`widget/` 是子目录，文件名不要改）。
2. 桌面长按 → 加号 → Scripting 组件 → 长按「编辑组件」→ 脚本选「今日热榜」。
3. 点开脚本（App 页）可以加榜单、调条数/字号/配色，也有「预览中号组件」。

组件参数（Parameter）：

- 留空：每次刷新按列表顺序换下一个榜单。
- 填榜单名（`知乎`）或榜单 ID（`mproPpoq6O`）：这个组件固定显示它。

## 这一版修了什么

上一版跑不起来，主要是几处 API 用错了，这次按参考项目逐个改：

| 上一版（错） | 这一版（对） |
| --- | --- |
| `FileManager.appGroupDocumentsDirectory` 存 JSON | `Storage.get/set`，App 与组件天然共用 |
| `Navigation.present(<App />)` | `Navigation.present({ element: <App />, modalPresentationStyle: "fullScreen" })` |
| 组件根视图靠系统内容边距 | 根 `ZStack` 按 `Widget.displaySize` 撑满，内缩自己算（`widget/view.tsx`） |
| `foregroundStyle="primary"` 这类猜的语义色 | 颜色用 `#${string}` 类型；背景给浅色/深色两套（`{ light, dark }`），字色按背景亮度自动选 |
| 每次刷新都联网 | 10 分钟缓存；被「安全验证」拦了先用电脑版 UA 重试，再退回旧缓存 |
| 点组件没有反应 | `widgetURL` 填当前榜单的网页地址，点一下直接打开 tophub 页面 |

## 点击行为

点整个组件会打开当前显示的那个榜单在 tophub 的网页（`https://tophub.today/n/<id>`），和原版一样。原版里每条热搜还能各自跳到自己的链接，小组件里做不到逐条设 URL，只能整块跳转。

## 深浅色

设置页里「外观」有两项：**浅色模式背景**、**深色模式背景**，分别给两种系统外观用。文字颜色不单独配，按背景亮度自动选：浅底用近黑、深底用纯白，次要文字（序号、时间）同理。这样把背景换成浅色也不会出现白字看不见。

## 已知限制

- **站点安全验证**：tophub 会对非浏览器请求返回 403 验证页。脚本已经做了双 UA 重试和缓存回退，但在被拦且没有缓存时，组件只能显示「暂时取不到数据」。
- **单条热搜点击**：组件里只能整块点击（打开当前榜单网页），做不了每条各自跳转；Scripting 的 `Link` 目前不保证在小组件里可用。
- **斜体没做**：Scripting 的斜体要走 `styledText`，字号不好控，前三名改成红色 + 加粗，观感和原版接近。
- **图标**：直接用 `Image imageUrl` 加载 tophub 的图标地址（实测不带 Referer 也能取到）；取不到就只显示文字。

## 排查

- 组件空白：先在 App 里打开脚本看看设置页能不能开，能开说明是组件取数问题，看控制台日志。
- 一直「暂时取不到」：站点在拦，点开脚本按「立即刷新主屏幕组件」，或者清空缓存再试。
- 想恢复默认：删除脚本重装即可（Storage 会跟着脚本清掉）。
