import { $, Resource, component$, useOnWindow, useResource$, useStore, useStylesScoped$ } from '@builder.io/qwik'
import type { QwikMouseEvent } from '@builder.io/qwik'
import { type DocumentHead } from '@builder.io/qwik-city'
import cloneDeep from 'lodash.clonedeep'

import Controls from '~/components/Controls'

import styles from './index.css?inline'

export type ShapeType = 'image' | 'rectangle' | 'circle' | 'triangle'

export interface DrawShapeInput {
  fillColor: string
  leftX: number
  topY: number
  rightX: number
  bottomY: number
  src?: string
  type?: ShapeType
}

export interface Shape {
  fillColor: string
  leftX: number
  topY: number
  rightX: number
  bottomY: number
  borderRadius: string
  rotate: string
  type: ShapeType
  src?: string
  id: string
}

export interface State {
  canvasMouseMoveCoords: { clientX: number; clientY: number } | null
  canvasMouseDownCoords: { clientX: number; clientY: number } | null
  shapeMouseDownCoords: { clientX: number; clientY: number } | null
  resizeMouseDownCoords: { clientX: number; clientY: number; corner: number } | null
  rotateMouseDownCoords: { clientX: number; clientY: number } | null

  shapes: Shape[]
  selectedShape?: Shape
  history: { [key: number]: { shapes: Shape[] } }
  savesCount: number
  currShapeType: ShapeType

  selectedColor: string

  scale: number
  maxScale: number
  minScale: number
  zoomFactor: number
  zoomPos: { x: number; y: number }

  commandText: string
  keyDown: string
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  showKeyShortcuts: boolean
}

interface Point {
  x: number
  y: number
}

const MIN_SHAPE_SIZE = 1

const parseShapeRotation = (rotate: string) => {
  if (rotate.endsWith('rad')) return parseFloat(rotate)
  if (rotate.endsWith('deg')) return (parseFloat(rotate) * Math.PI) / 180
  return 0
}

const rotatePoint = ({ x, y }: Point, radians: number): Point => ({
  x: x * Math.cos(radians) - y * Math.sin(radians),
  y: x * Math.sin(radians) + y * Math.cos(radians),
})

const getShapeCenter = (shape: Shape): Point => ({
  x: shape.leftX + Math.abs(shape.rightX - shape.leftX) / 2,
  y: shape.topY + Math.abs(shape.bottomY - shape.topY) / 2,
})

const getShapeDimensions = (shape: Shape) => ({
  width: Math.abs(shape.rightX - shape.leftX),
  height: Math.abs(shape.bottomY - shape.topY),
})

const getCornerSigns = (corner: number) => {
  switch (corner) {
    case 0:
      return { x: -1, y: -1 }
    case 1:
      return { x: 1, y: -1 }
    case 2:
      return { x: -1, y: 1 }
    default:
      return { x: 1, y: 1 }
  }
}

const getCornerIndexFromSigns = (x: number, y: number) => {
  if (x < 0 && y < 0) return 0
  if (x >= 0 && y < 0) return 1
  if (x < 0 && y >= 0) return 2
  return 3
}

const getShapeCornerPoint = (shape: Shape, corner: number): Point => {
  const { width, height } = getShapeDimensions(shape)
  const center = getShapeCenter(shape)
  const radians = parseShapeRotation(shape.rotate)
  const signs = getCornerSigns(corner)
  const cornerOffset = rotatePoint({ x: (width / 2) * signs.x, y: (height / 2) * signs.y }, radians)

  return {
    x: center.x + cornerOffset.x,
    y: center.y + cornerOffset.y,
  }
}

const getResizeHandleAngle = (corner: number) => (corner === 0 || corner === 3 ? 45 : -45)

export default component$(() => {
  useStylesScoped$(styles)

  const state = useStore<State>(
    {
      canvasMouseMoveCoords: null,
      canvasMouseDownCoords: null,
      shapeMouseDownCoords: null,
      resizeMouseDownCoords: null,
      rotateMouseDownCoords: null,

      shapes: [],
      selectedShape: undefined,
      history: { 0: { shapes: [] } },
      savesCount: 0,
      currShapeType: 'rectangle',

      selectedColor: 'rgb(43, 27, 208)',

      scale: 1,
      maxScale: 4,
      minScale: 0.1,
      zoomFactor: 0.03,
      zoomPos: { x: 0, y: 0 },

      commandText: '',
      keyDown: '',
      metaKey: false,
      shiftKey: false,
      altKey: false,
      showKeyShortcuts: false,
    },
    { deep: true }
  )

  const saveState = $(() => {
    const nextHistory: State['history'] = {}

    for (let i = 0; i <= state.savesCount; i += 1) {
      if (state.history[i]) nextHistory[i] = state.history[i]
    }

    const nextIndex = state.savesCount + 1
    nextHistory[nextIndex] = cloneDeep({ shapes: state.shapes })

    state.history = nextHistory
    state.savesCount = nextIndex
  })

  const undoState = $(() => {
    if (state.savesCount <= 0) return

    const newState = state.history[--state.savesCount]
    if (!newState) return

    state.shapes = cloneDeep(newState.shapes)
    state.selectedShape = undefined
  })

  const redoState = $(() => {
    const nextState = state.history[state.savesCount + 1]
    if (!nextState) return

    state.savesCount += 1
    state.shapes = cloneDeep(nextState.shapes)
    state.selectedShape = undefined
  })

  const clearShapes = $(() => {
    state.shapes = []
    state.selectedShape = undefined
    saveState()
  })

  const correctRectangleDirection = $(
    ({ leftX, topY, rightX, bottomY }: { leftX: number; topY: number; rightX: number; bottomY: number }) => ({
      leftX: leftX > rightX ? rightX : leftX,
      topY: topY > bottomY ? bottomY : topY,
      rightX: leftX > rightX ? leftX : rightX,
      bottomY: topY > bottomY ? topY : bottomY,
    })
  )

  const moveShape = $((shape: Shape, xDiff: number, yDiff: number) => {
    shape.leftX += xDiff
    shape.topY += yDiff
    shape.rightX += xDiff
    shape.bottomY += yDiff
  })

  const moveShapeCorner = $((pointerX: number, pointerY: number, shape: Shape, corner: number) => {
    if (!state.resizeMouseDownCoords) return

    const radians = parseShapeRotation(shape.rotate)
    const fixedCorner = getShapeCornerPoint(shape, 3 - corner)
    const localVector = rotatePoint({ x: pointerX - fixedCorner.x, y: pointerY - fixedCorner.y }, -radians)
    const previousSigns = getCornerSigns(corner)

    const normalizedVector = {
      x:
        Math.abs(localVector.x) < MIN_SHAPE_SIZE
          ? previousSigns.x * MIN_SHAPE_SIZE
          : localVector.x,
      y:
        Math.abs(localVector.y) < MIN_SHAPE_SIZE
          ? previousSigns.y * MIN_SHAPE_SIZE
          : localVector.y,
    }

    const centerOffset = rotatePoint({ x: normalizedVector.x / 2, y: normalizedVector.y / 2 }, radians)
    const center = {
      x: fixedCorner.x + centerOffset.x,
      y: fixedCorner.y + centerOffset.y,
    }
    const width = Math.abs(normalizedVector.x)
    const height = Math.abs(normalizedVector.y)

    shape.leftX = center.x - width / 2
    shape.topY = center.y - height / 2
    shape.rightX = center.x + width / 2
    shape.bottomY = center.y + height / 2
    state.resizeMouseDownCoords.corner = getCornerIndexFromSigns(normalizedVector.x, normalizedVector.y)
  })

  const drawShape = $(async (props: DrawShapeInput) => {
    const { fillColor, leftX, topY, rightX, bottomY, src, type } = props
    const correctedCoords = await correctRectangleDirection({ leftX, topY, rightX, bottomY })

    const shape: Shape = {
      ...correctedCoords,
      fillColor,
      rotate: '0deg',
      borderRadius: (type || state.currShapeType) === 'circle' ? '50%' : '0%',
      id: `id${Date.now()}`,
      type: type || state.currShapeType,
    }

    if (src && shape.type === 'image') shape.src = src

    state.shapes.push(shape)
    state.selectedShape = shape
    saveState()
  })

  const deleteShape = $((shape: Shape) => {
    state.shapes = state.shapes.filter((s) => s.id !== shape.id)
    state.selectedShape = undefined
    saveState()
  })

  const bringToFront = $((shape: Shape) => {
    const shapeIndex = state.shapes.findIndex((s) => s.id === shape.id)
    if (shapeIndex > -1) {
      const [removedShape] = state.shapes.splice(shapeIndex, 1)
      state.shapes.push(removedShape)
      saveState()
    }
  })

  const screenToCanvas = $((screenX: number, screenY: number) => ({
    canvasX: (screenX - state.zoomPos.x - (innerWidth / 2) * (1 - state.scale)) / state.scale,
    canvasY: (screenY - state.zoomPos.y - (innerHeight / 2) * (1 - state.scale)) / state.scale,
  }))

  const canvasToScreen = $((canvasX: number, canvasY: number) => ({
    screenX: canvasX * state.scale + state.zoomPos.x + (innerWidth / 2) * (1 - state.scale),
    screenY: canvasY * state.scale + state.zoomPos.y + (innerHeight / 2) * (1 - state.scale),
  }))

  const handleShapeRotateMouseDown = $((e: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    e.stopPropagation()
    state.rotateMouseDownCoords = { clientX: e.clientX, clientY: e.clientY }
  })

  const handleShapeResizeMouseDown = $((e: QwikMouseEvent<HTMLSpanElement, MouseEvent>, corner: number) => {
    e.stopPropagation()
    state.resizeMouseDownCoords = { clientX: e.clientX, clientY: e.clientY, corner }
  })

  const handleShapeMouseDown = $((e: QwikMouseEvent<HTMLSpanElement, MouseEvent>, shape: Shape) => {
    if (state.keyDown === 'Shift') {
      state.shapeMouseDownCoords = { clientX: e.clientX, clientY: e.clientY }
      state.selectedShape = shape
    }
  })

  const handleShapeClick = $((e: QwikMouseEvent<HTMLSpanElement>, shape: Shape) => {
    e.stopPropagation()

    if (state.commandText === 'Delete') deleteShape(shape)
    else if (state.commandText === 'Bring to Front') bringToFront(shape)
    else state.selectedShape = shape
  })

  const handleCanvasMouseDown = $(({ clientX, clientY }: QwikMouseEvent<HTMLDivElement, MouseEvent>) => {
    state.canvasMouseDownCoords = { clientX, clientY }
  })

  const handleCanvasEventMove = $(async (clientX: number, clientY: number) => {
    if (state.commandText === 'Pan' && state.canvasMouseDownCoords) {
      state.zoomPos.x += clientX - (state.canvasMouseMoveCoords?.clientX || clientX)
      state.zoomPos.y += clientY - (state.canvasMouseMoveCoords?.clientY || clientY)
    }

    const getScreenCoordDiff = async (startX: number, startY: number) => {
      const { screenX: startClientX, screenY: startClientY } = await canvasToScreen(startX, startY)
      const { screenX: endClientX, screenY: endClientY } = await canvasToScreen(clientX, clientY)
      return { xDiff: endClientX - startClientX, yDiff: endClientY - startClientY }
    }

    if (state.keyDown === 'Shift' && state.shapeMouseDownCoords && state.selectedShape) {
      const { clientX: startX, clientY: startY } = state.shapeMouseDownCoords
      const { xDiff, yDiff } = await getScreenCoordDiff(startX, startY)
      moveShape(state.selectedShape, xDiff, yDiff)
      state.shapeMouseDownCoords = { clientX, clientY }
    }

    if (state.resizeMouseDownCoords) {
      if (!state.selectedShape) return

      const { corner } = state.resizeMouseDownCoords
      const { canvasX, canvasY } = await screenToCanvas(clientX, clientY)
      moveShapeCorner(canvasX, canvasY, state.selectedShape, corner)
      state.resizeMouseDownCoords.clientX = clientX
      state.resizeMouseDownCoords.clientY = clientY
    }

    if (state.rotateMouseDownCoords) {
      if (!state.selectedShape) return

      const { canvasX: startX, canvasY: startY } = await screenToCanvas(
        state.rotateMouseDownCoords.clientX,
        state.rotateMouseDownCoords.clientY
      )
      const { leftX, topY, rightX, bottomY } = state.selectedShape
      const centerX = leftX + (rightX - leftX) / 2
      const centerY = topY + (bottomY - topY) / 2

      const radians = Math.atan2(startX - centerX, startY - centerY)
      const cornerRadians = Math.atan2(rightX - centerX, topY - centerY)

      state.selectedShape.rotate = `${-(radians - cornerRadians)}rad`
      state.rotateMouseDownCoords.clientX = clientX
      state.rotateMouseDownCoords.clientY = clientY
    }

    state.canvasMouseMoveCoords = { clientX, clientY }
  })

  const handleCanvasMouseMove = $(async ({ clientX, clientY }: QwikMouseEvent<HTMLDivElement, MouseEvent>) => {
    handleCanvasEventMove(clientX, clientY)
  })

  const handleCanvasRelease = $(async (releaseX: number, releaseY: number) => {
    const transformedShape =
      !!state.canvasMouseMoveCoords &&
      (!!state.shapeMouseDownCoords || !!state.resizeMouseDownCoords || !!state.rotateMouseDownCoords)

    if (!state.keyDown && state.canvasMouseDownCoords) {
      const { clientX, clientY } = state.canvasMouseDownCoords
      const mouseMoved = releaseX - clientX !== 0 && releaseY - clientY !== 0

      const { canvasX: leftX, canvasY: topY } = await screenToCanvas(clientX, clientY)
      const { canvasX: rightX, canvasY: bottomY } = await screenToCanvas(releaseX, releaseY)

      if (mouseMoved) await drawShape({ fillColor: state.selectedColor, leftX, topY, rightX, bottomY })
      else state.selectedShape = undefined
    } else if (transformedShape) {
      saveState()
    }

    state.canvasMouseMoveCoords = null
    state.canvasMouseDownCoords = null
    state.shapeMouseDownCoords = null
    state.resizeMouseDownCoords = null
    state.rotateMouseDownCoords = null
  })

  const handleCanvasMouseUp = $(async ({ clientX, clientY }: QwikMouseEvent<HTMLDivElement, MouseEvent>) => {
    handleCanvasRelease(clientX, clientY)
  })

  const previewStyle = useResource$<Record<string, string> | undefined>(async ({ track }) => {
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
      '--left': `${coords.leftX}px`,
      '--top': `${coords.topY}px`,
      '--height': `${Math.abs(coords.bottomY - coords.topY)}px`,
      '--width': `${Math.abs(coords.rightX - coords.leftX)}px`,
      '--background': state.selectedColor,
      '--border-radius': state.currShapeType === 'circle' ? '50%' : '0px',
    }
  })

  useOnWindow(
    'keydown',
    $((e: Event) => {
      const { key, metaKey, shiftKey, altKey } = e as KeyboardEvent

      state.keyDown = key
      state.metaKey = metaKey
      state.shiftKey = shiftKey
      state.altKey = altKey

      switch (key) {
        case 'F':
        case 'f':
          state.commandText = 'Bring to Front'
          break
        case 'Backspace':
          if (state.selectedShape) deleteShape(state.selectedShape)
          state.commandText = 'Delete'
          break
        case 'Shift':
          state.commandText = 'Move'
          break
        case ' ':
          state.commandText = 'Pan'
          break
        case 'Meta':
          state.commandText = 'Zoom'
          break
        case 'c':
          state.currShapeType = 'circle'
          state.commandText = 'Circle'
          break
        case 'r':
          state.currShapeType = 'rectangle'
          state.commandText = 'Rectangle'
          break
        case 't':
          state.currShapeType = 'triangle'
          state.commandText = 'Triangle'
          break
        case 'i':
          state.commandText = 'Image'
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
    $(async (event: Event) => {
      const e = event as WheelEvent & { wheelDelta?: number; originalEvent?: { detail?: number } }

      e.preventDefault()
      if (!e.metaKey) return

      const zoomPointX = e.clientX - window.innerWidth / 2
      const zoomPointY = e.clientY - window.innerHeight / 2

      const { screenX, screenY } = await canvasToScreen(zoomPointX, zoomPointY)

      const direction = e.wheelDelta || e.originalEvent?.detail || 0
      const delta = Math.max(-1, Math.min(1, direction))

      const scale = state.scale + delta * state.zoomFactor * state.scale
      state.scale = Math.max(state.minScale, Math.min(state.maxScale, scale))

      state.zoomPos.x = -screenX * state.scale + zoomPointX
      state.zoomPos.y = -screenY * state.scale + zoomPointY
    })
  )

  return (
    <>
      <Controls
        state={state}
        onUndo={undoState}
        onRedo={redoState}
        onClear={clearShapes}
        onResetZoom={$(() => {
          state.scale = 1
        })}
        onSelectShapeType={$((shapeType: ShapeType) => {
          state.currShapeType = shapeType
        })}
        setSelectedColor={$((color: string) => {
          state.selectedColor = color
        })}
        drawShape={drawShape}
        screenToCanvas={screenToCanvas}
      />

      <div
        class="h-screen w-full max-w-screen bg-stone-900 overflow-hidden absolute inset-0 z-0 touch-pan-y touch-pan-x select-none"
        onMouseDown$={handleCanvasMouseDown}
        onMouseMove$={handleCanvasMouseMove}
        onMouseUp$={handleCanvasMouseUp}
        onClick$={() => (state.selectedShape = undefined)}
        preventdefault:mousedown
        preventdefault:mouseup
      >
        <div
          class="canvas h-full w-full"
          style={{
            transform: `translate(${state.zoomPos.x}px, ${state.zoomPos.y}px) scale(${state.scale})`,
          }}
        >
          {state.shapes.map((shape) => {
            const dotSize = 12
            const dotPos = `${-(dotSize / 2 / state.scale)}px`
            const isSelected = state.selectedShape?.id === shape.id
            const height = Math.abs(shape.bottomY - shape.topY || 1)
            const width = Math.abs(shape.rightX - shape.leftX || 1)

            return (
              <span
                key={shape.id}
                onClick$={(e) => handleShapeClick(e, shape)}
                onMouseDown$={(e) => handleShapeMouseDown(e, shape)}
                preventdefault:mousedown
                class={`shape absolute ${state.keyDown === 'Shift' ? 'cursor-grab active:cursor-grabbing' : ''} ${
                  state.commandText === 'Bring to Front' ? 'cursor-crosshair' : ''
                }`}
                style={{
                  '--left': `${shape.leftX}px`,
                  '--top': `${shape.topY}px`,
                  '--height': `${height}px`,
                  '--width': `${width}px`,
                  '--border-radius': shape.borderRadius,
                  '--rotate': shape.rotate,
                  '--background': shape.fillColor,
                }}
              >
                <div class="h-full w-full relative">
                  {shape.type === 'image' && (
                    <img
                      src={shape.src}
                      alt="Shape image"
                      class="h-full w-full absolute object-contain rounded-[var(--border-radius)]"
                    />
                  )}

                  {isSelected && (
                    <>
                      <span class="h-full w-full absolute" style={{ border: `${1 / state.scale}px solid white` }} />

                      {[
                        { top: dotPos, left: dotPos },
                        { top: dotPos, right: dotPos },
                        { bottom: dotPos, left: dotPos },
                        { bottom: dotPos, right: dotPos },
                      ].map((dotLocation, i) => (
                        <span
                          key={i}
                          onMouseDown$={(e) => handleShapeResizeMouseDown(e, i)}
                          class="selected-shape__resize-handle absolute flex items-center justify-center"
                          style={{
                            height: `${dotSize / state.scale}px`,
                            width: `${dotSize / state.scale}px`,
                            '--handle-icon-rotate': `${getResizeHandleAngle(i)}deg`,
                            ...dotLocation,
                          }}
                        >
                          <svg
                            class="selected-shape__resize-handle-icon overflow-visible"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <g transform="rotate(var(--handle-icon-rotate) 12 12)">
                              <path
                                d="M6.5 12h11"
                                fill="none"
                                stroke="currentColor"
                                stroke-linecap="round"
                                stroke-width="1.75"
                              />
                              <path
                                d="M6.5 12l3-3M6.5 12l3 3"
                                fill="none"
                                stroke="currentColor"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="1.75"
                              />
                              <path
                                d="M17.5 12l-3-3M17.5 12l-3 3"
                                fill="none"
                                stroke="currentColor"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="1.75"
                              />
                            </g>
                          </svg>
                        </span>
                      ))}

                      <div
                        class="absolute top-0 bottom-0 m-auto w-2 h-fit transition-opacity"
                        style={{
                          '--slider-width': '8px',
                          '--slider-height': `clamp(50px, ${height / 2}px, ${(130 + height / 4) * state.scale}px)`,
                          left: `calc(100% + calc(.75rem * ${1 / state.scale}))`,
                          scale: `${1 / state.scale}`,
                          opacity: state.rotateMouseDownCoords ? '0' : '1',
                        }}
                      >
                        <div class="flex justify-center items-center rotate-90 -mb-4">
                          <input
                            style={{ minWidth: 'var(--slider-height)' }}
                            class="selected-shape__range cursor-ns-resize outline-none rounded-full bg-gray-700 appearance-none"
                            onMouseDown$={(e) => e.stopPropagation()}
                            type="range"
                            min="0"
                            max="50"
                            step="0.5"
                            value={parseInt(shape.borderRadius)}
                            onInput$={(e) => {
                              shape.borderRadius = `${parseFloat((e.target as HTMLInputElement).value || '0')}%`
                            }}
                          />
                          <output class="text-gray-400 w-4 text-[.65rem] flex items-center justify-between -rotate-90">
                            {shape.borderRadius}
                          </output>
                        </div>
                      </div>

                      <div
                        class="slider absolute left-full bottom-full text-gray-500 cursor-grab active:cursor-grabbing"
                        onMouseDown$={(e) => handleShapeRotateMouseDown(e)}
                      >
                        <div class="relative">
                          <svg
                            style={{ opacity: state.rotateMouseDownCoords ? '0' : '1', rotate: '25deg' }}
                            class="transition-opacity"
                            stroke="currentColor"
                            fill="currentColor"
                            viewBox="0 0 256 256"
                            height={`${20 / state.scale}px`}
                            width={`${20 / state.scale}px`}
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M236,184a12,12,0,0,1-24,0A84,84,0,0,0,68.6,124.6L53.11,140H88a12,12,0,0,1,0,24H24a12,12,0,0,1-12-12V88a12,12,0,0,1,24,0v35.16l15.66-15.55A108,108,0,0,1,236,184Z"></path>
                          </svg>

                          <span
                            style={{
                              opacity: state.rotateMouseDownCoords ? '1' : '0',
                              rotate: `calc(-1 * ${shape.rotate})`,
                            }}
                            class="absolute left-full bottom-full text-gray-400 w-4 text-[.65rem] flex items-center justify-between cursor-pointer transition-opacity"
                            onClick$={() => (shape.rotate = '0deg')}
                          >
                            {shape.rotate.includes('rad')
                              ? `${(parseFloat(shape.rotate) * (180 / Math.PI)).toFixed(1)}º`
                              : `${parseFloat(shape.rotate).toFixed(1)}º`}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </span>
            )
          })}

          <Resource
            value={previewStyle}
            onResolved={(styles) => (styles ? <span class="shape absolute" style={styles} /> : <span />)}
          />
        </div>
      </div>
    </>
  )
})

export const head: DocumentHead = {
  title: 'Qwikdraw',
}
