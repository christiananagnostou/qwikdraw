import { expect, test } from '@playwright/test'

test('color picker updates swatch from palette and hue strip', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/')

  const swatch = page.getByTitle('Pick a color')
  await swatch.click()

  const swatchColorBefore = await swatch.evaluate((el) => getComputedStyle(el).backgroundColor)

  const palette = page.locator('div[style="height: 200px; width: 200px;"]').first()
  await palette.click({ position: { x: 60, y: 60 } })

  await expect
    .poll(async () => swatch.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(swatchColorBefore)

  const swatchColorAfterPalette = await swatch.evaluate((el) => getComputedStyle(el).backgroundColor)

  const hueStrip = page.locator('div[style*="linear-gradient(to right, rgb(255, 0, 0), rgb(255, 0, 255), rgb(0, 0, 255)"]').first()
  const swatchColorBeforeHue = swatchColorAfterPalette
  await hueStrip.click({ position: { x: 140, y: 12 } })

  await expect
    .poll(async () => swatch.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(swatchColorBeforeHue)
})
