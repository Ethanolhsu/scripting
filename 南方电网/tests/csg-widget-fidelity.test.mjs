import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const settingsSource = readFileSync(
  new URL("../scripts/南方电网/components/widget_settings_page.tsx", import.meta.url),
  "utf8",
)
const widgetSource = readFileSync(
  new URL("../scripts/南方电网/components/widget_view.tsx", import.meta.url),
  "utf8",
)

function functionSource(name, nextName) {
  const start = widgetSource.indexOf(`function ${name}`)
  const end = widgetSource.indexOf(`function ${nextName}`, start + 1)
  assert.notEqual(start, -1, `missing ${name}`)
  assert.notEqual(end, -1, `missing ${nextName}`)
  return widgetSource.slice(start, end)
}

test("lets the native four-style selector adapt to the available page width", () => {
  const selectorTitle = settingsSource.indexOf('title="小组件样式"')
  const selectorStart = settingsSource.lastIndexOf("<Picker", selectorTitle)
  const selectorEnd = settingsSource.indexOf("</Picker>", selectorStart)
  const selector = settingsSource.slice(selectorStart, selectorEnd + "</Picker>".length)

  assert.ok(selector.includes('frame={{ maxWidth: "infinity", height: 34 }}'), "selector does not use the compact native height")
  assert.ok(selector.includes('listRowInsets={{ top: 6, bottom: 6, leading: 8, trailing: 8 }}'), "selector card retains native excess insets")
  assert.ok(!selector.includes("width: 338"), "selector still forces the old fixed width")
})

test("keeps the Widget settings cards compact and uses a full-width capsule apply action", () => {
  const metricRow = settingsSource.slice(
    settingsSource.indexOf("function WidgetMetricPickerRow"),
    settingsSource.indexOf("function WidgetDivider"),
  )
  const applyButton = settingsSource.slice(
    settingsSource.indexOf("function WidgetApplyButton"),
    settingsSource.indexOf("function GradientOption"),
  )

  assert.ok(settingsSource.includes('frame={{ minHeight: 174, maxWidth: "infinity" }}'), "preview card retains excess vertical space")
  assert.ok(settingsSource.includes('listRowInsets={{ top: 8, bottom: 8, leading: 0, trailing: 0 }}'), "preview card insets are not compact")
  assert.ok(metricRow.includes('frame={{ minHeight: 44, maxWidth: "infinity" }}'), "metric rows are not 44pt")
  assert.ok(metricRow.includes('listRowInsets={{ top: 0, bottom: 0, leading: 16, trailing: 16 }}'), "metric rows retain native vertical insets")
  assert.ok(settingsSource.includes('frame={{ minHeight: 44, maxWidth: "infinity" }}'), "gradient rows are not compact")
  assert.ok(applyButton.includes('frame={{ minHeight: 50, maxWidth: "infinity" }}'), "apply button is not full width and 50pt high")
  assert.ok(applyButton.includes('cornerRadius={25}'), "apply button is not a capsule")
  assert.ok(applyButton.includes('systemName="checkmark"'), "apply button is missing the checkmark")
  assert.ok(settingsSource.includes("<WidgetApplyButton action={handleApply}"), "compact apply action is not wired to the existing save handler")
  assert.ok(settingsSource.includes("patchSettings(configuration())"), "apply action no longer saves Widget settings")
  assert.ok(settingsSource.includes("Widget.reloadAll()"), "apply action no longer reloads Widgets")
})

test("matches the approved 158pt ice gauge anatomy", () => {
  const source = functionSource("IceGaugeSmallWidgetView", "TealGlassMediumWidgetView")

  for (const marker of [
    'frame={{ height: 20, maxWidth: "infinity" }}',
    'frame={{ width: 138, height: 70 }}',
    'colors: ["#82D9E3", "#F6C453", "#FF786F"]',
    '>正常</Text>',
    '>本年阶梯</Text>',
    'tierChineseLabel(tier)',
    'foregroundStyle="#F6C453"',
    'foregroundStyle="#FF786F"',
    'alignment="bottomTrailing"',
    'frame={{ height: 40, maxWidth: "infinity" }}',
  ]) {
    assert.ok(source.includes(marker), `ice gauge missing fidelity marker: ${marker}`)
  }

  assert.ok(!source.includes("当前阶梯"), "ice gauge still uses the superseded wording")
})

test("shows only hour and minute in the ice-gauge refresh label", () => {
  const source = functionSource("IceGaugeSmallWidgetView", "TealGlassMediumWidgetView")
  const formatter = functionSource("formatIceRefreshTime", "formatDataUpdateTime")

  assert.ok(source.includes("formatIceRefreshTime(data)"), "ice gauge does not use its time-only formatter")
  assert.ok(!source.includes("formatDataUpdateTime(data)"), "ice gauge still uses the month/day formatter")
  assert.ok(formatter.includes("getHours()"), "time-only formatter does not include hours")
  assert.ok(formatter.includes("getMinutes()"), "time-only formatter does not include minutes")
  assert.ok(!formatter.includes("getMonth()"), "time-only formatter can still render a month")
  assert.ok(!formatter.includes("formatMonthDay"), "time-only formatter still falls back to a date")
})

test("matches the approved tier dashboard card geometry and alignment", () => {
  const dashboard = functionSource("TierDashboardMediumWidgetView", "TierRailPanel")
  const rail = functionSource("TierRailPanel", "TierNode")
  const primary = functionSource("TierPrimaryMetric", "TierSecondaryMetric")
  const secondary = functionSource("TierSecondaryMetric", "ClassicMediumWidgetView")

  assert.ok(dashboard.includes('<HStack spacing={8} frame={{ height: 112, maxWidth: "infinity" }}>'))
  assert.ok(dashboard.includes('<VStack spacing={6} frame={{ maxWidth: "infinity", height: 112 }}>'))
  assert.ok(dashboard.includes('frame={{ maxWidth: "infinity", height: 54 }}'))
  assert.ok(rail.includes('padding={{ top: 9, leading: 13, bottom: 22, trailing: 4 }}'))
  assert.ok(rail.includes("年度阶梯"))
  assert.ok(rail.includes("tierChineseLabel(tier)"))
  assert.ok(rail.includes("formatDataUpdateTime(props.data)"), "rail update text must retain the update prefix")
  assert.ok(rail.includes('alignment="bottom"'), "update time is not centered on the panel bottom edge")
  assert.equal(
    (rail.match(/frame=\{\{ width: 2, height: 11 \}\}/g) ?? []).length,
    2,
    "tier rail connectors are not lengthened equally",
  )
  for (const marker of [
    '<Text font={8} foregroundStyle={props.muted}>年度阶梯</Text>',
    '<Text font={20} fontWeight="bold"',
    '<Text font={9} fontWeight="semibold"',
    '<Text font={8} foregroundStyle={props.muted} lineLimit={1}',
    '<Image systemName="clock" font={8} />',
    '<Text font={8} lineLimit={1}>',
  ]) {
    assert.ok(rail.includes(marker), `tier panel missing enlarged text marker: ${marker}`)
  }

  assert.ok(primary.includes('frame={{ height: 52, maxWidth: "infinity" }}'))
  assert.ok(primary.includes("<Spacer minLength={4} />"), "primary label and value are not distributed horizontally")
  assert.ok(primary.includes('font={9}'), "primary metric title was not enlarged")
  assert.ok(!primary.includes("chevron.right"), "primary card still contains the browser-inconsistent chevron")
  assert.ok(secondary.includes('alignment="center"'))
  assert.ok(secondary.includes('alignment: "center"'))
  assert.ok(secondary.includes('font={8}'), "secondary metric titles were not enlarged")
})
