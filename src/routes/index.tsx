import { $, Resource, component$, useResource$ } from '@builder.io/qwik'
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

  const screenToCanvas = $((screenX: number, screenY: number) => {
    return {
      canvasX: screenX * state.scale - state.zoomPos.x,
      canvasY: screenY * state.scale - state.zoomPos.y,
    }
  })

  const canvasToScreen = $((canvasX: number, canvasY: number) => {
    return {
      screenX: (canvasX - state.zoomPos.x) / state.scale,
      screenY: (canvasY - state.zoomPos.y) / state.scale,
    }
  })

  const handleShapeResizeMouseDown = $((e: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    e.stopPropagation()
    const { clientX, clientY } = e
    state.resizeMouseDownCoords = { clientX, clientY }
  })

  const handleCanvasMouseDown = $(({ clientX, clientY }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    state.canvasMouseDownCoords = { clientX, clientY }
  })

  const handleCanvasMouseMove = $(({ clientX, clientY }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    if (state.metaKey && state.canvasMouseDownCoords) {
      // Pan Canvas
      state.zoomPos.x += clientX - (state.canvasMouseMoveCoords?.clientX || clientX)
      state.zoomPos.y += clientY - (state.canvasMouseMoveCoords?.clientY || clientY)
    }

    state.canvasMouseMoveCoords = { clientX, clientY }
  })

  const handleCanvasMouseUp = $(async (e: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    const { clientX: endClientX, clientY: endClientY } = e

    // Draw Shape
    if (!state.keyDown && state.canvasMouseDownCoords) {
      const { clientX, clientY } = state.canvasMouseDownCoords
      const mouseMoved = endClientX - clientX !== 0 && endClientY - clientY !== 0

      const { canvasX: leftX, canvasY: topY } = await screenToCanvas(clientX, clientY)
      const { canvasX: rightX, canvasY: bottomY } = await screenToCanvas(endClientX, endClientY)

      mouseMoved
        ? await drawRectangle({ fillColor: state.selectedColor, leftX, topY, rightX, bottomY })
        : await selectShape(leftX, topY)
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

  const previewStyle = useResource$<any>(async ({ track }) => {
    const canvasMouseDownCoords = track(() => state.canvasMouseDownCoords)
    const canvasMouseMoveCoords = track(() => state.canvasMouseMoveCoords)

    if (!canvasMouseDownCoords || !canvasMouseMoveCoords || state.keyDown) return

    const { canvasX: leftX, canvasY: topY } = await screenToCanvas(
      canvasMouseDownCoords.clientX,
      canvasMouseDownCoords.clientY
    )
    const { canvasX: rightX, canvasY: bottomY } = await screenToCanvas(
      canvasMouseMoveCoords.clientX,
      canvasMouseMoveCoords.clientY
    )
    const coords = await correctRectangleDirection({ leftX, topY, rightX, bottomY })

    return {
      '--left': coords.leftX + 'px',
      '--top': coords.topY + 'px',
      '--height': Math.abs(coords.bottomY - coords.topY) + 'px',
      '--width': Math.abs(coords.rightX - coords.leftX) + 'px',
      '--background': state.selectedColor,
    }
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
        case 'f':
          state.commandText = 'Bring to Front'
          break
        case 'Meta':
          state.commandText = 'Zoom / Pan'
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
    $(async (e: any) => {
      e.preventDefault()
      if (!e.metaKey) return

      const zoomPointX = e.clientX - window.innerWidth / 2
      const zoomPointY = e.clientY - window.innerHeight / 2

      let delta = e.wheelDelta
      if (delta === undefined) delta = e.originalEvent.detail // we are on firefox
      delta = Math.max(-1, Math.min(1, delta)) // cap the delta to [-1,1] for cross browser consistency

      // determine the point on where the slide is zoomed in
      const { screenX, screenY } = await canvasToScreen(zoomPointX, zoomPointY)

      // apply zoom
      const newScale = state.scale + delta * state.zoomFactor * state.scale
      state.scale = Math.max(0.1, Math.min(state.maxScale, newScale))

      // calculate x and y based on zoom
      state.zoomPos.x = -screenX * state.scale + zoomPointX
      state.zoomPos.y = -screenY * state.scale + zoomPointY
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
          {state.shapes.map((shape) => (
            <>
              <span
                class="shape absolute"
                style={{
                  '--left': shape.leftX + 'px',
                  '--top': shape.topY + 'px',
                  '--height': Math.abs(shape.bottomY - shape.topY || 1) + 'px',
                  '--width': Math.abs(shape.rightX - shape.leftX || 1) + 'px',
                  '--border-radius': shape.borderRadius + 'px',
                  '--background': shape.fillColor,
                }}
              >
                {shape.isSelected && (
                  <div class="h-full w-full relative" style={{ border: shape.isSelected ? '1px solid white' : 'none' }}>
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
          ))}

          {/* Shape Preview */}
          <Resource
            value={previewStyle}
            onResolved={(styles: CSSModuleClasses | undefined) => <span class="shape absolute" style={styles} />}
          />
        </div>
      </div>
    </>
  )
})

export const head: DocumentHead = {
  title: 'Qwik Ascii',
}
