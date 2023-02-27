import { useTask$ } from '@builder.io/qwik'
import { $, component$, type QwikMouseEvent, useStore, useStylesScoped$ } from '@builder.io/qwik'
import { type DocumentHead } from '@builder.io/qwik-city'
import cloneDeep from 'lodash.clonedeep'
import Canvas from '~/models/ascii/canvas'
import styles from './ascii.css?inline'

export const WIDTH = 20
export const HEIGHT = 20

export const canvas = new Canvas(HEIGHT, WIDTH)

interface Rectangle {
  fillColor: string
  leftX: number
  topY: number
  rightX: number
  bottomY: number
  erasedPos: { [key: string]: number }
}

type Shape = Rectangle

interface State {
  mouseDownCoords: { clientX: number; clientY: number } | null
  draggingCoords: { clientX: number; clientY: number } | null
  selectedColor: string
  shapes: Shape[]
  history: { [key: number]: { shapes: Shape[] } }
  savesCount: number
}

export default component$(() => {
  useStylesScoped$(styles)

  const state = useStore<State>(
    {
      mouseDownCoords: null,
      draggingCoords: null,
      selectedColor: 'red',
      shapes: [],
      history: {},
      savesCount: -1,
    },
    { deep: true }
  )

  useTask$(({ track }) => {
    track(() => state.shapes)
    console.log(state)
  })

  const saveState = $(() => {
    state.history[++state.savesCount] = cloneDeep({ shapes: state.shapes })
  })

  const undoState = $(() => {
    if (state.savesCount === 0) return

    const newState = state.history[--state.savesCount]
    if (!newState) return
    state.shapes = newState.shapes
  })

  const redoState = $(() => {
    if (state.savesCount === Object(state.history).keys().length - 1) return

    const newState = state.history[++state.savesCount]
    if (!newState) return
    state.shapes = newState.shapes
  })

  const clearShapes = $(() => {
    state.shapes = []
    saveState()
  })

  const moveShape = $((shape: Shape, xDiff: number, yDiff: number) => {
    shape.leftX += xDiff
    shape.topY += yDiff
    shape.rightX += xDiff
    shape.bottomY += yDiff
  })

  const addErasedPosToShape = $((shape: Shape, x: number, y: number) => {
    shape.erasedPos[x - shape.leftX + ',' + (y - shape.topY)] = 1
  })

  const isErasedPos = $((shape: Shape, x: number, y: number) => {
    return shape.erasedPos[x - shape.leftX + ',' + (y - shape.topY)]
  })

  const shapeContainsPos = $(async (shape: Shape, x: number, y: number) => {
    return (
      shape.leftX <= x &&
      shape.topY <= y &&
      shape.rightX >= x &&
      shape.bottomY >= y &&
      !(await isErasedPos(shape, x, y))
    )
  })

  const getIndexOfShapeAtPos = $(async (x: number, y: number) => {
    let i = state.shapes.length
    while (i--) {
      const shape = state.shapes[i]
      if (await shapeContainsPos(shape, x, y)) return i
    }
    return -1
  })

  const getAllShapesAtPos = $((x: number, y: number) => {
    return state.shapes.filter((shape) => shapeContainsPos(shape, x, y))
  })

  const drawRectangle = $((fillColor: string, leftX: number, topY: number, rightX: number, bottomY: number) => {
    const rectangle = { fillColor, leftX, topY, rightX, bottomY, erasedPos: {} }

    if (leftX > rightX) {
      rectangle.rightX = leftX
      rectangle.leftX = rightX
    }
    if (topY > bottomY) {
      rectangle.bottomY = topY
      rectangle.topY = bottomY
    }

    state.shapes.push(rectangle)
    saveState()
  })

  const dragAndDrop = $(async (selectX: number, selectY: number, releaseX: number, releaseY: number) => {
    const xDiff = releaseX - selectX
    const yDiff = releaseY - selectY

    const shape = state.shapes[await getIndexOfShapeAtPos(selectX, selectY)]
    if (!shape) return
    moveShape(shape, xDiff, yDiff)

    saveState()
  })

  const eraseArea = $(async (leftX: number, topY: number, rightX: number, bottomY: number) => {
    for (let y = topY; y <= bottomY; y++) {
      for (let x = leftX; x <= rightX; x++) {
        const shapes = await getAllShapesAtPos(x, y)
        shapes.forEach((shape) => addErasedPosToShape(shape, x, y))
      }
    }

    saveState()
  })

  const bringToFront = $(async (selectX: number, selectY: number) => {
    const shapeIndex = await getIndexOfShapeAtPos(selectX, selectY)
    if (shapeIndex > -1) {
      const [removedShape] = state.shapes.splice(shapeIndex, 1)
      state.shapes.push(removedShape)
    }

    saveState()
  })

  const handleMouseDown = $(({ clientX, clientY, shiftKey, altKey }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    if (altKey) return
    const coords = { clientX, clientY }
    shiftKey ? (state.draggingCoords = coords) : (state.mouseDownCoords = coords)
  })

  const handleMouseUp = $(
    ({ clientX: endClientX, clientY: endClientY, altKey }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
      if (state.draggingCoords) {
        const { clientX, clientY } = state.draggingCoords
        dragAndDrop(clientX, clientY, endClientX, endClientY)
      }
      if (state.mouseDownCoords) {
        const { clientX, clientY } = state.mouseDownCoords
        console.log(clientX, clientY, endClientX, endClientY)
        drawRectangle(state.selectedColor, clientX, clientY, endClientX, endClientY)
      }
      if (altKey) {
        bringToFront(endClientX, endClientY)
      }

      state.mouseDownCoords = null
      state.draggingCoords = null
      console.log(state.shapes)
    }
  )

  return (
    <>
      <div class="flex justify-between items-stretch">
        <div class="flex gap-1">
          {['red', 'orange', 'yellow', 'green', 'blue', 'purple'].map((color) => (
            <button
              style={{ background: color }}
              onClick$={() => (state.selectedColor = color)}
              class={`px-4 border border-slate-700 rounded ${
                state.selectedColor === color && 'shadow shadow-slate-600'
              }`}
            />
          ))}
        </div>

        <div class="flex items-center max-w-fit gap-1">
          <button onClick$={undoState} class="p-[.15rem] border border-slate-700 rounded">
            <svg
              stroke="currentColor"
              fill="currentColor"
              stroke-width="0"
              viewBox="0 0 24 24"
              height="1em"
              width="1em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M9 10h6c1.654 0 3 1.346 3 3s-1.346 3-3 3h-3v2h3c2.757 0 5-2.243 5-5s-2.243-5-5-5H9V5L4 9l5 4v-3z"></path>
            </svg>
          </button>

          <button onClick$={redoState} class="p-[.15rem] border border-slate-700 rounded">
            <svg
              stroke="currentColor"
              fill="currentColor"
              stroke-width="0"
              viewBox="0 0 24 24"
              height="1em"
              width="1em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M16.82,4,15.4,5.44,17.94,8H8.23a6,6,0,0,0,0,12h2V18h-2a4,4,0,0,1,0-8h9.71L15.4,12.51l1.41,1.41L21.77,9Z"></path>
            </svg>
          </button>

          <button class="py-[.15rem] px-2 text-xs border border-slate-700 rounded" onClick$={clearShapes}>
            Clear
          </button>
        </div>
      </div>

      <div
        class="h-[1000px] w-full border mt-2 rounded"
        onMouseDown$={handleMouseDown}
        onMouseUp$={handleMouseUp}
        preventdefault:mousedown
        preventdefault:mouseup
      >
        {state.shapes.map((shape) => (
          <span
            class="shape absolute"
            style={{
              '--left': shape.leftX + 'px',
              '--top': shape.topY + 'px',
              '--height': Math.abs(shape.bottomY - shape.topY || 1) + 'px',
              '--width': Math.abs(shape.rightX - shape.leftX || 1) + 'px',
              '--background': shape.fillColor,
            }}
          />
        ))}
      </div>
    </>
  )
})

export const head: DocumentHead = {
  title: 'Qwik Ascii',
}
