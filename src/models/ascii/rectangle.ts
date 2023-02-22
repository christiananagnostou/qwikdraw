export default class Rectangle {
  leftX
  topY
  rightX
  bottomY
  fillColor
  erasedPos = new Map<string, number>()

  constructor(fillColor: string, leftX: number, topY: number, rightX: number, bottomY: number) {
    this.leftX = leftX
    this.topY = topY
    this.rightX = rightX
    this.bottomY = bottomY
    this.fillColor = fillColor
  }

  addErasedPos(x: number, y: number) {
    this.erasedPos.set(x - this.leftX + ',' + (y - this.topY), 1)
  }

  isErasedPos(x: number, y: number) {
    return this.erasedPos.has(x - this.leftX + ',' + (y - this.topY))
  }

  containsPos(x: number, y: number) {
    return this.leftX <= x && this.topY <= y && this.rightX >= x && this.bottomY >= y && !this.isErasedPos(x, y)
  }

  move(xDiff: number, yDiff: number) {
    this.leftX += xDiff
    this.topY += yDiff
    this.rightX += xDiff
    this.bottomY += yDiff
  }

  forEachPos(callback: ({ x, y }: { x: number; y: number }) => any) {
    for (let y = this.topY; y <= this.bottomY; y++) {
      for (let x = this.leftX; x <= this.rightX; x++) {
        callback({ x, y })
      }
    }
  }
}
