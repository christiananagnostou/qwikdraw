import { $, component$ } from '@builder.io/qwik'
import { type QwikMouseEvent, useStore, useStylesScoped$ } from '@builder.io/qwik'
import { type DocumentHead } from '@builder.io/qwik-city'
import cloneDeep from 'lodash.clonedeep'

import { Redo } from '~/components/icons/redo'
import { Undo } from '~/components/icons/undo'
import Colors from '~/components/colors'
import styles from './ascii.css?inline'
import { useOnWindow } from '@builder.io/qwik'

interface Shape {
  fillColor: string
  leftX: number
  topY: number
  rightX: number
  bottomY: number
  borderRadius: number
  isSelected: boolean
}

export interface State {
  canvasMouseDownCoords: { clientX: number; clientY: number } | null
  canvasMouseMoveCoords: { clientX: number; clientY: number } | null
  resizeMouseDownCoords: { clientX: number; clientY: number } | null

  selectedColor: string
  baseColor: string

  scale: number
  maxScale: number
  zoomFactor: number
  zoomTarget: { x: number; y: number }
  zoomPos: { x: number; y: number }

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
      canvasMouseDownCoords: null,
      canvasMouseMoveCoords: null,
      resizeMouseDownCoords: null,

      selectedColor: 'rgb(255,0,0)',
      baseColor: 'rgb(255,0,0)',

      scale: 1,
      maxScale: 4,
      zoomFactor: 0.05,
      zoomTarget: { x: 0, y: 0 },
      zoomPos: { x: 0, y: 0 },

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

  const shapeContainsPos = $(async (shape: Shape, x: number, y: number) => {
    return shape.leftX <= x && shape.topY <= y && shape.rightX >= x && shape.bottomY >= y
  })

  const getIndexOfShapeAtPos = $(async (x: number, y: number) => {
    let i = state.shapes.length
    while (i--) {
      const shape = state.shapes[i]
      if (await shapeContainsPos(shape, x, y)) return i
    }
    return -1
  })

  const getShapeAtPos = $(async (x: number, y: number) => {
    return state.shapes[await getIndexOfShapeAtPos(x, y)]
  })

  const correctRectangleDirection = $(
    ({ leftX, topY, rightX, bottomY }: { leftX: number; topY: number; rightX: number; bottomY: number }) => {
      return {
        leftX: leftX > rightX ? rightX : leftX,
        topY: topY > bottomY ? bottomY : topY,
        rightX: leftX > rightX ? leftX : rightX,
        bottomY: topY > bottomY ? topY : bottomY,
      }
    }
  )

  const drawRectangle = $(
    async (props: { fillColor: string; leftX: number; topY: number; rightX: number; bottomY: number }) => {
      const { fillColor, leftX, topY, rightX, bottomY } = props

      const correctedCoords = await correctRectangleDirection({ leftX, topY, rightX, bottomY })

      const rectangle = { ...correctedCoords, fillColor, borderRadius: 0, isSelected: false }
      state.shapes.push(rectangle)
      saveState()
    }
  )

  const dragAndDrop = $(async (selectX: number, selectY: number, releaseX: number, releaseY: number) => {
    const xDiff = releaseX - selectX
    const yDiff = releaseY - selectY

    const shape = state.shapes[await getIndexOfShapeAtPos(selectX, selectY)]
    if (!shape) return
    moveShape(shape, xDiff, yDiff)

    saveState()
  })

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

  const selectShape = $(async (clientX: number, clientY: number) => {
    state.shapes.forEach((shape) => (shape.isSelected = false))
    const shape = await getShapeAtPos(clientX, clientY)
    if (shape) shape.isSelected = true
  })

  // const getAllShapesAtPos = $((x: number, y: number) => {
  //   return state.shapes.filter((shape) => shapeContainsPos(shape, x, y))
  // })

  // const eraseArea = $(async (leftX: number, topY: number, rightX: number, bottomY: number) => {
  //   for (let y = topY; y <= bottomY; y++) {
  //     for (let x = leftX; x <= rightX; x++) {
  //       const shapes = await getAllShapesAtPos(x, y)
  //     }
  //   }
  //   saveState()
  // })

  const handleShapeResizeMouseDown = $((e: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    e.stopPropagation()
    const { clientX, clientY } = e
    state.resizeMouseDownCoords = { clientX, clientY }
  })

  const handleCanvasMouseMove = $(({ clientX, clientY }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    if (state.metaKey && state.canvasMouseDownCoords) {
      // Pan Canvas
      state.zoomPos.x += clientX - (state.canvasMouseMoveCoords?.clientX || clientX)
      state.zoomPos.y += clientY - (state.canvasMouseMoveCoords?.clientY || clientY)
    }

    state.canvasMouseMoveCoords = { clientX, clientY }
  })

  const handleCanvasMouseDown = $(({ clientX, clientY }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    state.canvasMouseDownCoords = { clientX, clientY }
  })

  const handleCanvasMouseUp = $(async (e: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    const { clientX: endClientX, clientY: endClientY } = e

    // Draw Shape
    if (state.commandText === '' && state.canvasMouseDownCoords) {
      const { clientX, clientY } = state.canvasMouseDownCoords
      const { scale, zoomPos } = state
      const mouseMoved = endClientX - clientX !== 0 && endClientY - clientY !== 0

      mouseMoved
        ? await drawRectangle({
            fillColor: state.selectedColor,
            leftX: (clientX - zoomPos.x) / scale,
            topY: (clientY - zoomPos.y) / scale,
            rightX: (endClientX - zoomPos.x) / scale,
            bottomY: (endClientY - zoomPos.y) / scale,
          })
        : await selectShape((clientX - zoomPos.x) / scale, (clientY - zoomPos.y) / scale)
    }

    // Move Shape
    if (state.commandText === 'Move' && state.canvasMouseDownCoords) {
      const { clientX, clientY } = state.canvasMouseDownCoords
      dragAndDrop(clientX, clientY, endClientX, endClientY)
    }

    // Delete Shape on Click
    if (state.commandText === 'Delete' && state.canvasMouseDownCoords) {
      const { clientX, clientY } = state.canvasMouseDownCoords
      deleteShape(clientX, clientY)
    }

    // Bring Shape to Front
    if (state.commandText === 'Bring to Front') {
      bringToFront(endClientX, endClientY)
    }

    // Resize Shape
    if (state.commandText === '' && state.resizeMouseDownCoords) {
      console.log({ start: state.resizeMouseDownCoords, endClientX, endClientY })
    }

    state.canvasMouseDownCoords = null
    state.canvasMouseMoveCoords = null
    state.resizeMouseDownCoords = null
  })

  useOnWindow(
    'keydown',
    $((e: Event) => {
      // @ts-ignore
      const { key, metaKey, shiftKey, altKey } = e as {
        key: string
        metaKey: boolean
        shiftKey: boolean
        altKey: boolean
      }
      state.keyDown = key
      state.metaKey = metaKey
      state.shiftKey = shiftKey
      state.altKey = altKey

      state.commandText = ''
      console.log(key)

      switch (key) {
        case 'Backspace':
          state.shapes = state.shapes.filter((shape) => !shape.isSelected)
          saveState()
          state.commandText = 'Delete'
          break
        case 'Shift':
          state.commandText = 'Move'
          break
        case 'Meta':
          state.commandText = 'Bring to Front'
          break
        case 'z':
          if (shiftKey && metaKey) {
            state.commandText = 'Redo'
            redoState()
          } else if (metaKey) {
            state.commandText = 'Undo'
            undoState()
          }
          break
        default:
          state.commandText = ''
          break
      }
    })
  )

  useOnWindow(
    'keyup',
    $(() => {
      state.commandText = ''
      state.keyDown = ''
      state.metaKey = false
      state.altKey = false
      state.shiftKey = false
    })
  )

  useOnWindow(
    'wheel',
    $((e: any) => {
      e.preventDefault()
      if (!e.metaKey) return

      const zoomPointX = e.clientX - window.innerWidth / 2
      const zoomPointY = e.clientY - window.innerHeight / 2

      let delta = e.wheelDelta
      if (delta === undefined) delta = e.originalEvent.detail // we are on firefox
      delta = Math.max(-1, Math.min(1, delta)) // cap the delta to [-1,1] for cross browser consistency

      // determine the point on where the slide is zoomed in
      state.zoomTarget.x = (zoomPointX - state.zoomPos.x) / state.scale
      state.zoomTarget.y = (zoomPointY - state.zoomPos.y) / state.scale

      // apply zoom
      state.scale += delta * state.zoomFactor * state.scale
      state.scale = Math.max(0.1, Math.min(state.maxScale, state.scale))

      // calculate x and y based on zoom
      state.zoomPos.x = -state.zoomTarget.x * state.scale + zoomPointX
      state.zoomPos.y = -state.zoomTarget.y * state.scale + zoomPointY
    })
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

          <button class="h-8 px-4 text-xs border border-slate-700 rounded" onClick$={() => (state.scale = 1)}>
            {(state.scale * 100).toFixed(0)}%
          </button>
          <button
            class="h-8 px-4 text-xs border border-slate-700 rounded"
            onClick$={() => {
              state.zoomTarget = { x: 0, y: 0 }
            }}
          >
            Target {state.zoomTarget.x.toFixed(0)},{state.zoomTarget.y.toFixed(0)}
          </button>
          <button
            class="h-8 px-4 text-xs border border-slate-700 rounded"
            onClick$={() => {
              state.zoomPos = { x: 0, y: 0 }
            }}
          >
            Pos {state.zoomPos.x.toFixed(0)},{state.zoomPos.y.toFixed(0)}
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
        onMouseDown$={handleCanvasMouseDown}
        onMouseMove$={handleCanvasMouseMove}
        onMouseUp$={handleCanvasMouseUp}
        preventdefault:mousedown
        preventdefault:mouseup
      >
        <div
          class="h-full w-full"
          style={{
            transform: 'translate(' + state.zoomPos.x + 'px,' + state.zoomPos.y + 'px) scale(' + state.scale + ')',
          }}
        >
          {/* Drawn Shapes */}
          {state.shapes.map((shape) => {
            const styles = {
              '--left': shape.leftX + 'px',
              '--top': shape.topY + 'px',
              '--height': Math.abs(shape.bottomY - shape.topY || 1) + 'px',
              '--width': Math.abs(shape.rightX - shape.leftX || 1) + 'px',
              '--border-radius': shape.borderRadius + 'px',
            }

            return (
              <>
                <span
                  class="shape absolute"
                  style={{
                    ...styles,
                    '--background': shape.fillColor,
                  }}
                >
                  {shape.isSelected && (
                    <div
                      class="h-full w-full relative"
                      style={{ border: shape.isSelected ? '1px solid white' : 'none' }}
                    >
                      {/* Resize Dots */}
                      {['-top-1 -left-1', '-top-1 -right-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map((dot) => (
                        <span
                          class={`${dot} absolute h-2 w-2 bg-white rounded-full cursor-pointer`}
                          onMouseDown$={handleShapeResizeMouseDown}
                          preventdefault:mousedown
                        />
                      ))}
                    </div>
                  )}
                </span>
              </>
            )
          })}

          {/* Shape Preview */}
          {state.commandText === '' && state.canvasMouseDownCoords && state.canvasMouseMoveCoords && (
            <span
              class="shape absolute"
              style={(() => {
                if (!state.canvasMouseDownCoords || !state.canvasMouseMoveCoords) return

                const { scale, zoomPos } = state
                let { clientX: leftX, clientY: topY } = state.canvasMouseDownCoords
                let { clientX: rightX, clientY: bottomY } = state.canvasMouseMoveCoords

                leftX = (leftX - zoomPos.x) / scale
                topY = (topY - zoomPos.y) / scale
                rightX = (rightX - zoomPos.x) / scale
                bottomY = (bottomY - zoomPos.y) / scale

                const newLeftX = leftX > rightX ? rightX : leftX
                const newTopY = topY > bottomY ? bottomY : topY
                const newRightX = leftX > rightX ? leftX : rightX
                const newBottomY = topY > bottomY ? topY : bottomY

                return {
                  '--left': newLeftX + 'px',
                  '--top': newTopY + 'px',
                  '--height': Math.abs(newBottomY - newTopY) + 'px',
                  '--width': Math.abs(newRightX - newLeftX) + 'px',
                  '--background': state.selectedColor,
                }
              })()}
            />
          )}
        </div>
      </div>
    </>
  )
})

export const head: DocumentHead = {
  title: 'Qwik Ascii',
}
