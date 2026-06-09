import { expect, test, type Locator } from '@playwright/test'

const getCornerPoint = async (shape: Locator, corner: number) =>
  shape.evaluate((el, cornerIndex) => {
    const readNumber = (property: string) => parseFloat(el.style.getPropertyValue(property) || '0')
    const rotateValue = el.style.getPropertyValue('--rotate') || '0deg'
    const rotate = rotateValue.endsWith('rad')
      ? parseFloat(rotateValue)
      : (parseFloat(rotateValue) * Math.PI) / 180

    const left = readNumber('--left')
    const top = readNumber('--top')
    const width = readNumber('--width')
    const height = readNumber('--height')
    const centerX = left + width / 2
    const centerY = top + height / 2

    const signs =
      cornerIndex === 0
        ? { x: -1, y: -1 }
        : cornerIndex === 1
          ? { x: 1, y: -1 }
          : cornerIndex === 2
            ? { x: -1, y: 1 }
            : { x: 1, y: 1 }

    const localX = (width / 2) * signs.x
    const localY = (height / 2) * signs.y

    return {
      x: centerX + localX * Math.cos(rotate) - localY * Math.sin(rotate),
      y: centerY + localX * Math.sin(rotate) + localY * Math.cos(rotate),
    }
  }, corner)

test('resizing a rotated shape keeps the opposite corner fixed', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/')

  const canvas = page.locator('.canvas')
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('Canvas not rendered')

  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 180)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 320, canvasBox.y + 280)
  await page.mouse.up()

  const shape = page.locator('.shape').first()
  await expect(shape).toBeVisible()
  await shape.click()

  const rotateHandle = page.locator('.slider').first()
  const rotateBox = await rotateHandle.boundingBox()
  if (!rotateBox) throw new Error('Rotate handle not rendered')

  await page.mouse.move(rotateBox.x + rotateBox.width / 2, rotateBox.y + rotateBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(rotateBox.x + rotateBox.width / 2 + 30, rotateBox.y + rotateBox.height / 2 + 20)
  await page.mouse.move(rotateBox.x + rotateBox.width / 2 + 60, rotateBox.y + rotateBox.height / 2 + 40)
  await page.mouse.up()

  await expect
    .poll(async () => shape.evaluate((el) => el.style.getPropertyValue('--rotate')))
    .not.toBe('0deg')

  const oppositeCornerBefore = await getCornerPoint(shape, 3)

  const topLeftHandle = page.locator('.shape span.absolute').nth(1)
  const handleBox = await topLeftHandle.boundingBox()
  if (!handleBox) throw new Error('Resize handle not rendered')

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x - 40, handleBox.y - 25)
  await page.mouse.up()

  const oppositeCornerAfter = await getCornerPoint(shape, 3)

  expect(Math.abs(oppositeCornerAfter.x - oppositeCornerBefore.x)).toBeLessThan(1.5)
  expect(Math.abs(oppositeCornerAfter.y - oppositeCornerBefore.y)).toBeLessThan(1.5)
})
