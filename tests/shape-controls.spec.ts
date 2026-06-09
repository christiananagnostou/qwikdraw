import { expect, test } from '@playwright/test'

test('shape controls rail only appears for a selected rectangle', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/')

  await expect(page.getByLabel('Border radius')).toHaveCount(0)

  const canvas = page.locator('.canvas')
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('Canvas not rendered')

  await page.keyboard.press('r')
  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 180)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 320, canvasBox.y + 280)
  await page.mouse.up()

  await expect(page.getByRole('slider', { name: 'Border radius' })).toHaveCount(1)
  await expect(page.locator('.shape-controls__slider-track')).toBeVisible()

  await page.mouse.click(canvasBox.x + 500, canvasBox.y + 320)
  await expect(page.getByRole('slider', { name: 'Border radius' })).toHaveCount(0)

  await page.keyboard.press('c')
  await page.mouse.move(canvasBox.x + 200, canvasBox.y + 180)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 320, canvasBox.y + 300)
  await page.mouse.up()

  await expect(page.getByRole('slider', { name: 'Border radius' })).toHaveCount(0)
})

test('shape controls rail slider supports drag updates', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/')

  const canvas = page.locator('.canvas')
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('Canvas not rendered')

  await page.keyboard.press('r')
  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 180)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 320, canvasBox.y + 280)
  await page.mouse.up()

  const slider = page.getByRole('slider', { name: 'Border radius' })
  const valueBefore = await slider.getAttribute('aria-valuenow')
  const sliderBox = await slider.boundingBox()
  if (!sliderBox) throw new Error('Border radius slider not rendered')

  await page.mouse.move(sliderBox.x + sliderBox.width / 2, sliderBox.y + sliderBox.height - 8)
  await page.mouse.down()
  await page.mouse.move(sliderBox.x + sliderBox.width / 2, sliderBox.y + 20)
  await page.mouse.up()

  await expect.poll(async () => slider.getAttribute('aria-valuenow')).not.toBe(valueBefore)
})
