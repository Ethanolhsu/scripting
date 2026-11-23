import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

const expected = new Map([
  ["../scripts/南方电网/widget.tsx", "D4E3C9212B1C9A3CC07B54DAC79D34B5A853DE713F1E39B30D224AF220F60A04"],
  ["../scripts/南方电网/components/widget_view.tsx", "2ECE77D938F9192E9194BCBF95ED463CB3B99D041E36D33342E96C00F25CF405"],
  ["../scripts/南方电网/widget_config.ts", "4BFD30513DD6CE971F42483E296CB3A669F8BA7241E32D955E2E10A5034EB1CF"],
  ["../scripts/南方电网/widget_gradients.ts", "ABA2643F8800D4F9C1A55EC014AADAABB7C1F45817AB6AAAB2346AFC9E11CD6E"],
])

for (const [path, hash] of expected) {
  test(`keeps Widget UI source unchanged: ${path}`, () => {
    const actual = createHash("sha256")
      .update(readFileSync(new URL(path, import.meta.url)))
      .digest("hex")
      .toUpperCase()
    assert.equal(actual, hash)
  })
}
