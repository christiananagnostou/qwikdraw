import { expect, test } from '@playwright/test'

test('triangle mode draws a clipped triangle shape', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/')

  await page.keyboard.press('t')

  const canvas = page.locator('.canvas')
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('Canvas not rendered')

  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 180)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 320, canvasBox.y + 280)
  await page.mouse.up()

  const triangleFill = page.locator('.shape__fill--triangle').first()
  await expect(triangleFill).toBeVisible()

  await expect
    .poll(async () => triangleFill.evaluate((el) => getComputedStyle(el).clipPath))
    .toContain('polygon')
})
