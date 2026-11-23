import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const fullScreenUrl = new URL("../scripts/南方电网/components/full_screen_page.tsx", import.meta.url)
const index = readFileSync(new URL("../scripts/南方电网/index.tsx", import.meta.url), "utf8")
const login = readFileSync(new URL("../scripts/南方电网/components/qr_login_page.tsx", import.meta.url), "utf8")
const widgetSettings = readFileSync(new URL("../scripts/南方电网/components/widget_settings_page.tsx", import.meta.url), "utf8")
const tariff = readFileSync(new URL("../scripts/南方电网/components/local_tariff_entry_page.tsx", import.meta.url), "utf8")
const widgetView = readFileSync(new URL("../scripts/南方电网/components/widget_view.tsx", import.meta.url), "utf8")

test("uses native full-screen presentation without a custom scroll shell", () => {
  assert.ok(existsSync(fullScreenUrl), "missing shared full-screen page component")
  const fullScreen = existsSync(fullScreenUrl) ? readFileSync(fullScreenUrl, "utf8") : ""

  assert.ok(fullScreen.includes('modalPresentationStyle: "fullScreen"'), "full-screen presentation mode is missing")
  assert.ok(fullScreen.includes('buttonStyle="glassProminent"'), "shared primary action is not Liquid Glass")
  assert.ok(!fullScreen.includes("FullScreenPage"), "legacy full-screen shell still exists")
  assert.ok(!fullScreen.includes("ScrollView"), "shared helper still owns scrolling")
  assert.ok(index.includes("presentFullScreen(<MainView"), "root script is still presented as a sheet")
})

test("uses native grouped settings while preserving compact row dimensions", () => {
  for (const marker of ["<NavigationStack>", "<List", "<Section", 'listStyle="insetGroup"', "toast={{", "confirmationDialog={{"]) {
    assert.ok(index.includes(marker), `missing native settings marker: ${marker}`)
  }
  assert.ok(!index.includes("FullScreenPage"), "main settings still uses the custom shell")
  for (const marker of [
    'frame={{ width: 32, height: 32 }}',
    'frame={{ width: 36, height: 36 }}',
    'frame={{ minHeight: 54',
    'font={16}',
  ]) {
    assert.ok(index.includes(marker), `missing settings dimension: ${marker}`)
  }
})

test("uses the native login screen composition required for reliable controls", () => {
  for (const marker of [
    '<NavigationStack>',
    '<List',
    'listStyle="plain"',
    'scrollContentBackground="hidden"',
    '<Section',
    '<Picker',
    'pickerStyle="segmented"',
    'navigationTitle="扫码登录"',
    'navigationBarTitleDisplayMode="inline"',
    'frame={{ width: 58, height: 58 }}',
    'font={20}',
    'frame={{ maxWidth: "infinity", height: 38 }}',
    'frame={{ width: 232, minHeight: 236 }}',
    'frame={{ width: 176, height: 176 }}',
    "PrimaryButton",
    'listRowSeparator="hidden"',
    '<Button',
  ]) {
    assert.ok(login.includes(marker), `missing login composition marker: ${marker}`)
  }
  assert.ok(!login.includes("FullScreenPage"), "login screen still uses the custom full-screen shell")
})

test("uses native Widget settings without changing Widget preview components", () => {
  for (const marker of ["<NavigationStack>", "<List", "<Section", 'listStyle="insetGroup"']) {
    assert.ok(widgetSettings.includes(marker), `missing native Widget settings marker: ${marker}`)
  }
  assert.ok(!widgetSettings.includes("FullScreenPage"), "Widget settings still uses the custom shell")
  for (const marker of [
    'frame={{ maxWidth: "infinity", height: 34 }}',
    "MediumWidgetPreview",
    "SmallWidgetPreview",
    "WidgetMetricPickerRow",
    "WidgetApplyButton",
  ]) {
    assert.ok(widgetSettings.includes(marker), `missing Widget settings marker: ${marker}`)
  }
})

test("uses a native local tariff form while preserving OCR", () => {
  for (const marker of ["<NavigationStack>", "<List", "<Section", 'listStyle="insetGroup"']) {
    assert.ok(tariff.includes(marker), `missing native tariff marker: ${marker}`)
  }
  assert.ok(!tariff.includes("FullScreenPage"), "tariff screen still uses the custom shell")
  for (const marker of [
    'frame={{ minHeight: 190',
    'buttonStyle="glass"',
    "PrimaryButton",
    "Photos.pick",
    "Vision.recognizeText",
  ]) {
    assert.ok(tariff.includes(marker), `missing tariff composition marker: ${marker}`)
  }
})

test("keeps the classic Widget anatomy identical to the browser preview", () => {
  const classicStart = widgetView.indexOf("function ClassicMediumWidgetView")
  const classicEnd = widgetView.indexOf("function ClassicPrimaryPanel")
  const classic = widgetView.slice(classicStart, classicEnd)

  assert.ok(classic.includes("ClassicGridCard"), "classic right grid does not use the compact browser cards")
  assert.ok(!classic.includes("<MetricCard"), "classic right grid still renders progress and subtitle content")
})
