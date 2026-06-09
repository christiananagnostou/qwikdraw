import { expect, test, type Page } from '@playwright/test'

const drawRectangle = async (page: Page) => {
  const canvas = page.locator('.canvas')
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('Canvas not rendered')

  await page.keyboard.press('r')
  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 180)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 240, canvasBox.y + 220)
  await page.mouse.move(canvasBox.x + 320, canvasBox.y + 280)
  await page.mouse.up()
}

test('shape controls rail slider supports drag updates', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/')

  await drawRectangle(page)

  await expect(page.locator('.shape').first()).toBeVisible()
  await page.locator('.shape').first().click()

  const slider = page.getByRole('slider', { name: 'Border radius' })
  await expect(slider).toHaveCount(1)
  const valueBefore = await slider.getAttribute('aria-valuenow')
  const sliderBox = await slider.boundingBox()
  if (!sliderBox) throw new Error('Border radius slider not rendered')

  await page.mouse.move(sliderBox.x + sliderBox.width / 2, sliderBox.y + sliderBox.height - 8)
  await page.mouse.down()
  await page.mouse.move(sliderBox.x + sliderBox.width / 2, sliderBox.y + 20)
  await page.mouse.up()

  await expect.poll(async () => slider.getAttribute('aria-valuenow')).not.toBe(valueBefore)
})
