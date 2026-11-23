import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const gradientModuleUrl = new URL("../scripts/南方电网/widget_gradients.ts", import.meta.url)

test("defines six protected presets and normalizes a custom gradient", async () => {
  const {
    DEFAULT_WIDGET_GRADIENT_ID,
    WIDGET_GRADIENTS,
    appendCustomWidgetGradient,
    createCustomWidgetGradient,
    resolveWidgetGradient,
  } = await import(gradientModuleUrl)

  assert.equal(DEFAULT_WIDGET_GRADIENT_ID, "mist-blue")
  assert.equal(WIDGET_GRADIENTS.length, 6)
  assert.ok(WIDGET_GRADIENTS.every((gradient) => gradient.custom !== true))
  assert.deepEqual(WIDGET_GRADIENTS.at(-2).colors, ["#AFD7EC", "#537579"])
  assert.deepEqual(WIDGET_GRADIENTS.at(-1).colors, ["#FADDA7", "#70C7DA"])

  const custom = createCustomWidgetGradient(["#acd4e8", "#698b94"])
  assert.equal(custom.id, "custom")
  assert.equal(custom.custom, true)
  assert.deepEqual(custom.colors, ["#ACD4E8", "#8BB0BE", "#698B94"])
  const first = appendCustomWidgetGradient([], custom)
  const second = appendCustomWidgetGradient(first, createCustomWidgetGradient(["#778899", "#AABBCC"]))
  assert.deepEqual(second.map((item) => item.id), ["custom-1", "custom-2"])
  assert.deepEqual(second.map((item) => item.label), ["导入配色 1", "导入配色 2"])
  assert.equal(resolveWidgetGradient("custom-1", second).id, "custom-1")
  assert.equal(resolveWidgetGradient("custom-2", second).id, "custom-2")
  assert.equal(resolveWidgetGradient("missing", second).id, "mist-blue")
})

test("extracts unique hex colors from recognized text", async () => {
  const { extractHexColors } = await import(gradientModuleUrl)

  assert.deepEqual(
    extractHexColors("背景 #afd7ec，结束色 #537579；重复 #AFD7EC，忽略 #fff"),
    ["#AFD7EC", "#537579"],
  )
})

test("uses local-only image analysis and disposes the ephemeral WebView", () => {
  const source = readFileSync(new URL("../scripts/南方电网/widget_gradients.ts", import.meta.url), "utf8")

  for (const marker of [
    "Photos.pick",
    "limit: 6",
    "PHPickerFilter.images()",
    "Vision.recognizeText",
    "new WebViewController({ ephemeral: true })",
    "getImageData",
    "controller.dispose()",
    "importWidgetGradientsFromPhotos",
  ]) {
    assert.ok(source.includes(marker), `missing local gradient import marker: ${marker}`)
  }
  assert.doesNotMatch(source, /fetch\s*\(/, "gradient import must not upload the selected image")
})
