import { useOnDocument, $, component$ } from '@builder.io/qwik'
import { type QwikMouseEvent, useStore, useStylesScoped$ } from '@builder.io/qwik'
import { type DocumentHead } from '@builder.io/qwik-city'
import cloneDeep from 'lodash.clonedeep'

import { Redo } from '~/components/icons/redo'
import { Undo } from '~/components/icons/undo'
import Colors from '~/components/colors'
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

interface Shape extends Rectangle {
  isSelected: boolean
}

export interface State {
  mouseDownCoords: { clientX: number; clientY: number } | null
  selectedColor: string
  baseColor: string
  shapes: Shape[]
  history: { [key: number]: { shapes: Shape[] } }
  savesCount: number
  commandText: string
  keyDown: string
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export default component$(() => {
  useStylesScoped$(styles)

  const state = useStore<State>(
    {
      mouseDownCoords: null,
      selectedColor: 'rgb(255,0,0)',
      baseColor: 'rgb(255,0,0)',
      shapes: [],
      history: { 0: { shapes: [] } },
      savesCount: 0,
      commandText: '',
      keyDown: '',
      metaKey: false,
      shiftKey: false,
      altKey: false,
    },
    { deep: true }
  )

  const saveState = $(() => {
    state.history[++state.savesCount] = cloneDeep({ shapes: state.shapes })
  })

  const undoState = $(() => {
    if (state.savesCount <= 0) return

    const newState = state.history[--state.savesCount]
    if (!newState) return
    state.shapes = newState.shapes
  })

  const redoState = $(() => {
    if (state.savesCount + 1 === Object.keys(state.history).length) return

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

  // const addErasedPosToShape = $((shape: Shape, x: number, y: number) => {
  //   shape.erasedPos[x - shape.leftX + ',' + (y - shape.topY)] = 1
  // })

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

  // const getAllShapesAtPos = $((x: number, y: number) => {
  //   return state.shapes.filter((shape) => shapeContainsPos(shape, x, y))
  // })

  const getShapeAtPos = $(async (x: number, y: number) => {
    return state.shapes[await getIndexOfShapeAtPos(x, y)]
  })

  const drawRectangle = $((fillColor: string, leftX: number, topY: number, rightX: number, bottomY: number) => {
    const rectangle = {
      fillColor,
      leftX: leftX > rightX ? rightX : leftX,
      topY: topY > bottomY ? bottomY : topY,
      rightX: leftX > rightX ? leftX : rightX,
      bottomY: topY > bottomY ? topY : bottomY,
      erasedPos: {},
      isSelected: false,
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

  // const eraseArea = $(async (leftX: number, topY: number, rightX: number, bottomY: number) => {
  //   for (let y = topY; y <= bottomY; y++) {
  //     for (let x = leftX; x <= rightX; x++) {
  //       const shapes = await getAllShapesAtPos(x, y)
  //       shapes.forEach((shape) => addErasedPosToShape(shape, x, y))
  //     }
  //   }

  //   saveState()
  // })

  const deleteShape = $(async (selectX: number, selectY: number) => {
    state.shapes.splice(await getIndexOfShapeAtPos(selectX, selectY), 1)
  })

  const bringToFront = $(async (selectX: number, selectY: number) => {
    const shapeIndex = await getIndexOfShapeAtPos(selectX, selectY)
    if (shapeIndex > -1) {
      const [removedShape] = state.shapes.splice(shapeIndex, 1)
      state.shapes.push(removedShape)
    }

    saveState()
  })

  const handleMouseDown = $(({ clientX, clientY }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    state.mouseDownCoords = { clientX, clientY }
  })

  const selectShape = $(async (clientX: number, clientY: number) => {
    state.shapes.forEach((shape) => (shape.isSelected = false))
    const shape = await getShapeAtPos(clientX, clientY)
    if (shape) shape.isSelected = true
  })

  const handleMouseUp = $(
    async ({ clientX: endClientX, clientY: endClientY }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
      if (state.commandText === '' && state.mouseDownCoords) {
        const { clientX, clientY } = state.mouseDownCoords

        return endClientX - clientX === 0 && endClientY - clientY === 0
          ? await selectShape(clientX, clientY)
          : await drawRectangle(state.selectedColor, clientX, clientY, endClientX, endClientY)
      }

      if (state.commandText === 'Move' && state.mouseDownCoords) {
        const { clientX, clientY } = state.mouseDownCoords
        dragAndDrop(clientX, clientY, endClientX, endClientY)
      }

      if (state.commandText === 'Delete' && state.mouseDownCoords) {
        const { clientX, clientY } = state.mouseDownCoords
        deleteShape(clientX, clientY)
      }
      if (state.commandText === 'Resize') {
        // resize
      }

      if (state.commandText === 'Bring to Front') {
        bringToFront(endClientX, endClientY)
      }

      state.mouseDownCoords = null
    }
  )

  useOnDocument(
    'keydown',
    // @ts-ignore
    $(({ key, metaKey, shiftKey, altKey }: { key: string; metaKey: boolean; shiftKey: boolean; altKey: boolean }) => {
      state.commandText = ''

      console.log(key)

      state.keyDown = key
      state.metaKey = metaKey
      state.shiftKey = shiftKey
      state.altKey = altKey

      if (key === 'd') return (state.commandText = 'Delete')
      if (key === 'Shift') return (state.commandText = 'Move')
      if (key === 'Meta') return (state.commandText = 'Bring to Front')
      if (key === 'z') {
        if (shiftKey && metaKey) {
          state.commandText = 'Redo'
          redoState()
        } else if (metaKey) {
          state.commandText = 'Undo'
          undoState()
        }
        return
      }
      return (state.commandText = '')
    })
  )

  useOnDocument(
    'keyup',
    $(() => (state.commandText = ''))
  )

  return (
    <>
      {/* Controls */}
      <>
        <div class="absolute top-4 left-4 z-10">
          <Colors
            selectedColor={state.selectedColor}
            setSelectedColor={$((color: string) => (state.selectedColor = color))}
            baseColor={state.baseColor}
            setBaseColor={$((color: string) => (state.baseColor = color))}
          />
        </div>

        <div class="flex gap-1 text-lg text-white absolute bottom-4 left-4 z-10">
          <button onClick$={undoState} class="h-8 w-8 grid place-items-center border border-slate-700 rounded">
            <Undo />
          </button>

          <button onClick$={redoState} class="h-8 w-8 grid place-items-center border border-slate-700 rounded">
            <Redo />
          </button>

          <button class="h-8 px-4 text-xs border border-slate-700 rounded" onClick$={clearShapes}>
            Clear
          </button>
        </div>

        <div class="absolute top-4 right-4 z-10">
          <div
            class={`text-white px-4 h-8 text-xs border border-slate-700 rounded grid place-items-center 
      ${!state.commandText && 'hidden'}`}
          >
            {state.commandText}
          </div>
        </div>
      </>

      {/* Canvas */}
      <div
        class="h-screen w-full max-w-screen bg-stone-900 overflow-hidden absolute top-0 left-0 z-0"
        onMouseDown$={handleMouseDown}
        onMouseUp$={handleMouseUp}
        preventdefault:mousedown
        preventdefault:mouseup
      >
        {state.shapes.map((shape) => {
          const styles = {
            '--left': shape.leftX + 'px',
            '--top': shape.topY + 'px',
            '--height': Math.abs(shape.bottomY - shape.topY || 1) + 'px',
            '--width': Math.abs(shape.rightX - shape.leftX || 1) + 'px',
          }
          return (
            <>
              <span
                class="shape absolute"
                style={{
                  ...styles,
                  '--background': shape.fillColor,
                }}
              />

              {shape.isSelected && (
                <span
                  class="shape absolute"
                  style={{
                    ...styles,
                    border: shape.isSelected ? '1px solid white' : 'none',
                  }}
                ></span>
              )}
            </>
          )
        })}
      </div>
    </>
  )
})

export const head: DocumentHead = {
  title: 'Qwik Ascii',
}
