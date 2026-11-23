import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const configModuleUrl = new URL("../scripts/南方电网/widget_config.ts", import.meta.url)

test("uses the approved Widget defaults and swaps duplicate selections", async () => {
  const {
    DEFAULT_WIDGET_METRIC_IDS,
    DEFAULT_WIDGET_STYLE,
    normalizeWidgetMetricIds,
    updateWidgetMetricSlot,
  } = await import(configModuleUrl)

  assert.equal(DEFAULT_WIDGET_STYLE, "glass")
  assert.deepEqual(DEFAULT_WIDGET_METRIC_IDS, ["balance", "monthUsage", "previousBill", "yesterdayUsage"])
  assert.deepEqual(
    updateWidgetMetricSlot(DEFAULT_WIDGET_METRIC_IDS, 0, "previousBill"),
    ["previousBill", "monthUsage", "balance", "yesterdayUsage"],
  )
  assert.deepEqual(
    normalizeWidgetMetricIds(["previousBill", "balance", "monthUsage"]),
    ["previousBill", "balance", "monthUsage", "yesterdayUsage"],
  )
  assert.deepEqual(
    updateWidgetMetricSlot(DEFAULT_WIDGET_METRIC_IDS, 3, "monthUsage"),
    ["balance", "yesterdayUsage", "previousBill", "monthUsage"],
  )
})

test("normalizes invalid Widget settings and preserves the classic anatomy mapping", async () => {
  const {
    WIDGET_STYLES,
    normalizeWidgetConfiguration,
    resolveClassicMetricIds,
  } = await import(configModuleUrl)

  assert.deepEqual(WIDGET_STYLES, ["classic", "glass", "ice", "iceMedium"])

  const normalized = normalizeWidgetConfiguration({
    widgetStyle: "unknown",
    widgetMetricIds: ["balance", "balance", "missing"],
  })

  assert.equal(normalized.widgetStyle, "glass")
  assert.equal(normalized.iceAppearance, "dark")
  assert.equal(normalized.widgetGradientId, "mist-blue")
  assert.deepEqual(normalized.customWidgetGradients, [])
  assert.equal(new Set(normalized.widgetMetricIds).size, 4)
  assert.deepEqual(resolveClassicMetricIds(["previousBill", "monthBill", "balance"]), [
    "previousBill",
    "monthBill",
    "balance",
    "yesterdayUsage",
  ])
})

test("migrates the legacy single imported gradient into the multi-gradient library", async () => {
  const { normalizeWidgetConfiguration } = await import(configModuleUrl)
  const normalized = normalizeWidgetConfiguration({
    widgetGradientId: "custom",
    customWidgetGradient: {
      id: "custom",
      label: "导入配色",
      colors: ["#112233", "#445566"],
      tone: "light",
      custom: true,
    },
  })

  assert.equal(normalized.widgetGradientId, "custom-1")
  assert.equal(normalized.customWidgetGradients.length, 1)
  assert.equal(normalized.customWidgetGradients[0].id, "custom-1")
  assert.equal(normalized.customWidgetGradients[0].label, "导入配色 1")
})

test("wires the approved Widget configuration flow into production Scripting", () => {
  const index = readFileSync(new URL("../scripts/南方电网/index.tsx", import.meta.url), "utf8")
  const settingsPage = readFileSync(new URL("../scripts/南方电网/components/widget_settings_page.tsx", import.meta.url), "utf8")
  const widgetEntry = readFileSync(new URL("../scripts/南方电网/widget.tsx", import.meta.url), "utf8")
  const widgetView = readFileSync(new URL("../scripts/南方电网/components/widget_view.tsx", import.meta.url), "utf8")
  const power = readFileSync(new URL("../scripts/南方电网/services/power.ts", import.meta.url), "utf8")
  const metadata = JSON.parse(readFileSync(new URL("../scripts/南方电网/script.json", import.meta.url), "utf8"))

  for (const marker of ["WidgetSettingsPage", "小组件样式与显示内容已保存"]) {
    assert.ok(index.includes(marker), `missing native settings marker: ${marker}`)
  }
  for (const marker of [
    'pickerStyle="segmented"',
    "visibleMetricIds.map",
    "slotTitle(widgetStyle, index)",
    "`数据位 ${index + 1}`",
    'widgetStyle === "classic"',
    "Widget.preview",
    "Widget.reloadAll",
    "MediumWidgetPreview",
    "readWidgetCache",
    'tag="ice"',
    'tag="iceMedium"',
    "渐变配色",
    "从图片导入配色",
    "管理",
    "完成",
    "clearCustomWidgetGradient(item.id)",
    "customWidgetGradients",
    "importWidgetGradientsFromPhotos",
  ]) {
    assert.ok(settingsPage.includes(marker), `missing Widget settings marker: ${marker}`)
  }
  assert.ok(widgetEntry.includes("Widget.parameter"), "widget runtime does not read preview parameters")
  assert.equal(
    (widgetEntry.match(/Widget\.present\(/g) ?? []).length,
    2,
    "widget runtime should have one normal present call and one no-cache error present call",
  )
  for (const marker of [
    "ClassicMediumWidgetView",
    "ClassicPrimaryPanel",
    "secondary[2]",
    "TealGlassMediumWidgetView",
    "IceGaugeSmallWidgetView",
    "TierDashboardMediumWidgetView",
    "metricIds.slice(0, 3)",
    "resolveClassicMetricIds(metricIds)",
    '"#16213A"',
    '"#0B7285"',
    '"#25A18E"',
    'systemName="wallet.bifold.fill"',
    "cornerRadius={12}",
  ]) {
    assert.ok(widgetView.includes(marker), `missing production Widget marker: ${marker}`)
  }
  assert.ok(power.includes("previousMonthCharge"), "previous-month bill data is not fetched")
  assert.equal(metadata.version, "1.2.2")
  assert.equal(metadata.author, null)
})
