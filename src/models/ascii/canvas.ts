import Rectangle from './rectangle'
import cloneDeep from 'lodash.clonedeep'

export default class Canvas {
  height
  width
  shapes: Rectangle[] = []
  history: Map<number, { shapes: Rectangle[] }> = new Map()
  savesCount = -1

  constructor(height: number, width: number) {
    this.height = height
    this.width = width
    this.saveState()
  }

  saveState() {
    this.history.set(++this.savesCount, cloneDeep({ shapes: this.shapes }))
  }

  undoState() {
    if (this.savesCount === 0) return

    const state = this.history.get(--this.savesCount)
    if (!state) return
    this.shapes = state.shapes
  }

  redoState() {
    if (this.savesCount === this.history.size - 1) return

    const state = this.history.get(++this.savesCount)
    if (!state) return
    this.shapes = state.shapes
  }

  clearShapes() {
    this.shapes = []

    this.saveState()
  }

  resize(height: number, width: number) {
    this.height = height
    this.width = width
  }

  drawRectangle(fillColor: string, leftX: number, topY: number, rightX: number, bottomY: number) {
    this.shapes.push(new Rectangle(fillColor, Number(leftX), Number(topY), Number(rightX), Number(bottomY)))

    this.saveState()
  }

  dragAndDrop(selectX: number, selectY: number, releaseX: number, releaseY: number) {
    const xDiff = releaseX - selectX
    const yDiff = releaseY - selectY
    const shape = this.shapes[this.#getIndexOfShapeAtPos(selectX, selectY)]
    if (!shape) return
    shape.move(xDiff, yDiff)

    this.saveState()
  }

  eraseArea(leftX: number, topY: number, rightX: number, bottomY: number) {
    const erasedRect = new Rectangle('', leftX, topY, rightX, bottomY)
    erasedRect.forEachPos(({ x, y }) => this.#getAllShapesAtPos(x, y).forEach((shape) => shape.addErasedPos(x, y)))

    this.saveState()
  }

  bringToFront(selectX: number, selectY: number) {
    const shapeIndex = this.#getIndexOfShapeAtPos(selectX, selectY)
    if (shapeIndex) {
      const [removedShape] = this.shapes.splice(shapeIndex, 1)
      this.shapes.push(removedShape)
    }

    this.saveState()
  }

  printCanvas() {
    const grid = this.createGrid()
    grid.forEach((row) => console.log(row.join(' ')))
  }

  createGrid() {
    const grid: string[][] = [...Array(this.height)].map(() => [...Array(this.width)])

    this.shapes.forEach((shape) => {
      shape.forEachPos(({ x, y }) => {
        const isInBounds = x < this.width && y < this.height && x >= 0 && y >= 0
        const validPos = isInBounds && !shape.isErasedPos(x, y)
        if (validPos) grid[y][x] = shape.fillColor
      })
    })

    return grid
  }

  #getIndexOfShapeAtPos(x: number, y: number) {
    let i = this.shapes.length
    while (i--) if (this.shapes[i].containsPos(x, y)) return i
    return -1
  }

  #getAllShapesAtPos(x: number, y: number) {
    return this.shapes.filter((shape) => shape.containsPos(x, y))
  }
}
