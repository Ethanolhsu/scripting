import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const storage = readFileSync(new URL("../scripts/南方电网/storage.ts", import.meta.url), "utf8")
const power = readFileSync(new URL("../scripts/南方电网/services/power.ts", import.meta.url), "utf8")
const main = readFileSync(new URL("../scripts/南方电网/index.tsx", import.meta.url), "utf8")

test("repairs a saved single account that was never selected", () => {
  assert.ok(storage.includes("normalizeAccountSelection"), "settings do not normalize account selection")
  assert.ok(
    storage.includes("settings.linkedAccounts.length === 1 ? settings.linkedAccounts[0] : null"),
    "a sole linked account is not selected automatically",
  )
  assert.ok(
    storage.includes('paymentNumber || selectedAccount?.accountNumber || ""'),
    "the selected account number is not reflected in the payment field",
  )
})

test("persists the normalized selection after syncing accounts", () => {
  assert.ok(power.includes("normalizeAccountSelection"), "account sync does not normalize the new account list")
  assert.ok(power.includes("...normalizedSelection"), "account sync does not persist the normalized selection")
})

test("refreshes both selected account and payment number in the live main view", () => {
  const qrHandler = main.slice(main.indexOf("async function handleQrLoginResult"), main.indexOf("async function handleSyncAccounts"))
  const syncHandler = main.slice(main.indexOf("async function handleSyncAccounts"), main.indexOf("async function handleOpenLocalTariff"))

  for (const [name, handler] of [["QR login", qrHandler], ["manual sync", syncHandler]]) {
    assert.ok(handler.includes("setSelectedAccountNumber(latest.selectedAccount?.accountNumber ?? \"\")"), `${name} does not refresh the selected account`)
    assert.ok(handler.includes("setPaymentNumber(latest.paymentNumber)"), `${name} does not refresh the payment number`)
  }
})
