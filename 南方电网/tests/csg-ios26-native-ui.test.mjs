import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const main = read("../scripts/南方电网/index.tsx")
const shell = read("../scripts/南方电网/components/full_screen_page.tsx")
const login = read("../scripts/南方电网/components/qr_login_page.tsx")
const tariff = read("../scripts/南方电网/components/local_tariff_entry_page.tsx")
const widgets = read("../scripts/南方电网/components/widget_settings_page.tsx")

test("uses native SwiftUI containers for every app screen", () => {
  for (const [name, source] of [["main", main], ["login", login], ["tariff", tariff], ["widgets", widgets]]) {
    assert.ok(source.includes("<NavigationStack>"), `${name} is missing NavigationStack`)
    assert.ok(source.includes("<List"), `${name} is missing List`)
    assert.ok(source.includes("<Section"), `${name} is missing Section`)
    assert.ok(!source.includes("<FullScreenPage"), `${name} still uses FullScreenPage`)
  }
})

test("uses system dialogs, toast, and iOS 26 glass actions", () => {
  assert.ok(main.includes("confirmationDialog={{"), "main screen is missing a native confirmation dialog")
  assert.ok(main.includes("toast={{"), "main screen is missing the native toast modifier")
  assert.ok(shell.includes('buttonStyle="glassProminent"'), "primary actions do not use Liquid Glass")
  assert.ok(!shell.includes("<ScrollView>"), "shared page helper still owns a custom scroll hierarchy")
})

test("keeps read-only settings and QR channel callbacks", () => {
  assert.ok(main.includes("SettingsValueRow"))
  assert.ok(main.includes('title="扫码渠道"'))
  assert.ok(main.includes('title="已绑定账户"'))
  assert.ok(login.includes("onChannelChanged?.(nextChannel)"))
  assert.ok(login.includes("onAuthenticated"))
})
