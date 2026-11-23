import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(new URL("../scripts/南方电网/index.tsx", import.meta.url), "utf8")
const localTariffPageUrl = new URL("../scripts/南方电网/components/local_tariff_entry_page.tsx", import.meta.url)
const localTariffPage = existsSync(localTariffPageUrl) ? readFileSync(localTariffPageUrl, "utf8") : ""

test("uses the approved family overview settings hierarchy", () => {
  for (const marker of ["NavigationStack", "<List", "<Section", "CompactAccountOverview", "AccountActionRow", "当前设置", "工具", "数据与隐私"]) {
    assert.ok(source.includes(marker), `missing ${marker}`)
  }
  for (const legacyMarker of ["HeroStatusCard", "QuickActions"]) {
    assert.ok(!source.includes(legacyMarker), `legacy layout remains: ${legacyMarker}`)
  }
})

test("uses local image OCR and manual tariff entry instead of web search", () => {
  for (const marker of ["LocalTariffEntryPage", "录入当地电价"]) {
    assert.ok(source.includes(marker), `missing ${marker}`)
  }
  for (const legacyMarker of ["queryResidentTariffByCurrentLocation", "联网搜索当地电价", "tariffSearchUrl"]) {
    assert.ok(!source.includes(legacyMarker), `legacy web search remains: ${legacyMarker}`)
  }
  for (const marker of ["Photos.pick", "Vision.recognizeText", "直接编辑电价内容"]) {
    assert.ok(localTariffPage.includes(marker), `missing local entry marker: ${marker}`)
  }
})

test("shows operation status as a toast instead of a permanent account third line", () => {
  const accountOverview = source.slice(
    source.indexOf("function CompactAccountOverview"),
    source.indexOf("function AccountActionRow"),
  )

  assert.ok(source.includes("toast={{"), "operation feedback is not presented as a toast")
  assert.ok(source.includes("message: status"), "toast is not bound to operation status")
  assert.ok(!accountOverview.includes("props.status"), "account summary still renders a third status line")
})

test("constrains the browser-matched account summary dimensions", () => {
  const accountOverview = source.slice(
    source.indexOf("function CompactAccountOverview"),
    source.indexOf("function AccountActionRow"),
  )

  assert.ok(accountOverview.includes('frame={{ minHeight: 64, maxWidth: "infinity" }}'), "account summary is not fixed to 64pt")
  assert.ok(
    accountOverview.includes("frame={{ width: 36, height: 36 }}"),
    "main account icon is not constrained to 36pt",
  )
  assert.ok(accountOverview.includes('font={17} fontWeight="bold"'), "main account name is not prominent")
  assert.ok(accountOverview.includes('font={13} foregroundStyle={SECONDARY}'), "account number does not match the browser size")
})

test("uses a single-line account action row", () => {
  const accountActionRow = source.slice(
    source.indexOf("function AccountActionRow"),
    source.indexOf("function IconTile"),
  )

  assert.ok(!accountActionRow.includes("subtitle"), "account action rows still render subtitles")
  assert.ok(!accountActionRow.includes("<VStack"), "account action rows still use a two-line stack")
})

test("uses a single-line tool row", () => {
  const settingsRow = source.slice(
    source.indexOf("function AccountActionRow"),
    source.indexOf("function IconTile"),
  )

  assert.ok(!settingsRow.includes("subtitle"), "tool rows still render subtitles")
  assert.ok(!settingsRow.includes("<VStack"), "tool rows still use a two-line stack")
})

test("keeps native settings cards compact without shrinking action icons", () => {
  const accountActionRow = source.slice(
    source.indexOf("function AccountActionRow"),
    source.indexOf("function SettingsValueRow"),
  )
  const settingsValueRow = source.slice(
    source.indexOf("function SettingsValueRow"),
    source.indexOf("function IconTile"),
  )
  const iconTile = source.slice(
    source.indexOf("function IconTile"),
    source.indexOf("function PaymentNumberRow"),
  )
  const paymentNumberRow = source.slice(
    source.indexOf("function PaymentNumberRow"),
    source.indexOf("async function run"),
  )

  assert.ok(
    accountActionRow.includes('listRowInsets={{ top: 0, bottom: 0, leading: 0, trailing: 0 }}'),
    "action rows still inherit the native List row padding",
  )
  assert.ok(accountActionRow.includes('frame={{ minHeight: 48, maxWidth: "infinity", alignment: "leading" }}'), "action rows are not 48pt")
  assert.ok(settingsValueRow.includes('listRowInsets={{ top: 0, bottom: 0, leading: 16, trailing: 16 }}'), "setting rows do not use compact native insets")
  assert.ok(settingsValueRow.includes('frame={{ minHeight: 46, maxWidth: "infinity" }}'), "setting rows are not 46pt")
  assert.ok(paymentNumberRow.includes('listRowInsets={{ top: 0, bottom: 0, leading: 16, trailing: 16 }}'), "payment row does not use compact native insets")
  assert.ok(paymentNumberRow.includes('frame={{ minHeight: 46, maxWidth: "infinity" }}'), "payment row is not 46pt")
  assert.ok(iconTile.includes('frame={{ width: 32, height: 32 }}'), "action icon tile no longer remains 32pt")
})
