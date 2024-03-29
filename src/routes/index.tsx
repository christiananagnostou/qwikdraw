import { $, Resource, component$, useResource$, useOnWindow, useStore, useStylesScoped$ } from '@builder.io/qwik'
import type { QwikChangeEvent, QwikMouseEvent } from '@builder.io/qwik'
import { type DocumentHead } from '@builder.io/qwik-city'
import cloneDeep from 'lodash.clonedeep'

import styles from './index.css?inline'
import ColorPicker from '~/components/ColorPicker'

import { Redo } from '~/components/icons/redo'
import { Undo } from '~/components/icons/undo'
import { Keyboard } from '~/components/icons/keyboard'
import { Shift } from '~/components/icons/shift'
import { Command } from '~/components/icons/command'
import { Backspace } from '~/components/icons/backspace'
import { Rectangle } from '~/components/icons/retangle'
import { Circle } from '~/components/icons/circle'
import { ImageFile } from '~/components/icons/imageFile'
// import { Triangle } from '~/components/icons/triangle'

const KeyboardCommands = [
  { key: '⇧ Click', command: 'Move' },
  { key: 'F Click', command: 'Bring to Front' },
  { key: '⌘ Scroll', command: 'Zoom' },
  { key: 'Space Drag', command: 'Pan' },
  { key: '⌘ Z', command: 'Undo' },
  { key: '⇧ ⌘ Z', command: 'Redo' },
  { key: '⌫', command: 'Delete' },
  { key: 'c', command: 'Circle' },
  { key: 'r', command: 'Rectangle' },
  // { key: 't', command: 'Triangle' },
  { key: 'i', command: 'Image' },
]

interface Shape {
  fillColor: string
  leftX: number
  topY: number
  rightX: number
  bottomY: number
  borderRadius: string
  rotate: string
  type: 'image' | 'rectangle' | 'circle' | 'triangle'
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
  currShapeType: Shape['type']

  selectedColor: string

  scale: number
  maxScale: number
  zoomFactor: number
  zoomPos: { x: number; y: number }

  commandText: string
  keyDown: string
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  showKeyShortcuts: boolean
}

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
      zoomFactor: 0.05,
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

  const moveShape = $((shape: Shape, xDiff: number, yDiff: number) => {
    shape.leftX += xDiff
    shape.topY += yDiff
    shape.rightX += xDiff
    shape.bottomY += yDiff
  })

  const moveShapeCorner = $(async (xDiff: number, yDiff: number, shape: Shape, corner: number) => {
    if (!state.resizeMouseDownCoords) return
    let { leftX, topY, rightX, bottomY } = shape

    // Top Left
    if (corner === 0) {
      leftX += xDiff
      topY += yDiff
      if (leftX > rightX) state.resizeMouseDownCoords.corner = 1
      else if (topY > bottomY) state.resizeMouseDownCoords.corner = 2
    }
    // Top Right
    else if (corner === 1) {
      rightX += xDiff
      topY += yDiff
      if (leftX > rightX) state.resizeMouseDownCoords.corner = 0
      else if (topY > bottomY) state.resizeMouseDownCoords.corner = 3
    }
    // Bottom Left
    else if (corner === 2) {
      leftX += xDiff
      bottomY += yDiff
      if (leftX > rightX) state.resizeMouseDownCoords.corner = 3
      else if (topY > bottomY) state.resizeMouseDownCoords.corner = 0
    }
    // Bottom Right
    else if (corner === 3) {
      rightX += xDiff
      bottomY += yDiff
      if (leftX > rightX) state.resizeMouseDownCoords.corner = 2
      else if (topY > bottomY) state.resizeMouseDownCoords.corner = 1
    }

    const correctedCoords = await correctRectangleDirection({ leftX, topY, rightX, bottomY })
    shape.leftX = correctedCoords.leftX
    shape.topY = correctedCoords.topY
    shape.rightX = correctedCoords.rightX
    shape.bottomY = correctedCoords.bottomY
  })

  const drawShape = $(
    async (props: {
      fillColor: string
      leftX: number
      topY: number
      rightX: number
      bottomY: number
      src?: string
      type?: Shape['type']
    }) => {
      const { fillColor, leftX, topY, rightX, bottomY, src, type } = props
      const correctedCoords = await correctRectangleDirection({ leftX, topY, rightX, bottomY })

      const shape: Shape = {
        ...correctedCoords,
        fillColor,
        rotate: '0deg',
        borderRadius: state.currShapeType === 'circle' ? '50%' : '0%',
        id: 'id' + new Date().getTime(),
        type: type || state.currShapeType,
      }
      if (src && shape.type === 'image') shape.src = src
      state.shapes.push(shape)
      saveState()
      state.selectedShape = shape
    }
  )

  const deleteShape = $((shape: Shape) => {
    state.shapes = state.shapes.filter((s) => s.id !== shape.id)
  })

  const bringToFront = $((shape: Shape) => {
    const shapeIndex = state.shapes.findIndex((s) => s.id === shape.id)
    if (shapeIndex > -1) {
      const [removedShape] = state.shapes.splice(shapeIndex, 1)
      state.shapes.push(removedShape)
    }
    saveState()
  })

  const screenToCanvas = $((screenX: number, screenY: number) => {
    return {
      canvasX: (screenX - state.zoomPos.x - (innerWidth / 2) * (1 - state.scale)) / state.scale,
      canvasY: (screenY - state.zoomPos.y - (innerHeight / 2) * (1 - state.scale)) / state.scale,
    }
  })

  const canvasToScreen = $((canvasX: number, canvasY: number) => {
    return {
      screenX: (canvasX - state.zoomPos.x) / state.scale,
      screenY: (canvasY - state.zoomPos.y) / state.scale,
    }
  })

  // Rotate Mouse Handler
  const handleShapeRotateMouseDown = $((e: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    e.stopPropagation()
    state.rotateMouseDownCoords = { clientX: e.clientX, clientY: e.clientY }
  })

  // Resize Mouse Handler
  const handleShapeResizeMouseDown = $((e: QwikMouseEvent<HTMLSpanElement, MouseEvent>, corner: number) => {
    e.stopPropagation()
    state.resizeMouseDownCoords = { clientX: e.clientX, clientY: e.clientY, corner }
  })

  // Shape Mouse Handler
  const handleShapeMouseDown = $((e: QwikMouseEvent<HTMLSpanElement, MouseEvent>, shape: Shape) => {
    if (state.keyDown === 'Shift') {
      state.shapeMouseDownCoords = { clientX: e.clientX, clientY: e.clientY }
      state.selectedShape = shape
    }
  })

  const handleShapeClick = $((shape: Shape) => {
    if (state.commandText === 'Delete') deleteShape(shape)
    else if (state.commandText === 'Bring to Front') bringToFront(shape)
    else if (!state.canvasMouseDownCoords) state.selectedShape = shape
  })

  // Canvas Mouse Handlers
  const handleCanvasMouseDown = $(({ clientX, clientY }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    state.canvasMouseDownCoords = { clientX, clientY }
  })

  /**
   *
   * Canvas Mouse Move Listener
   *
   */
  const handleCanvasMouseMove = $(async ({ clientX, clientY }: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    // Pan Canvas
    if (state.commandText === 'Pan' && state.canvasMouseDownCoords) {
      state.zoomPos.x += clientX - (state.canvasMouseMoveCoords?.clientX || clientX)
      state.zoomPos.y += clientY - (state.canvasMouseMoveCoords?.clientY || clientY)
    }

    const getScreenCoordDiff = async (startX: number, startY: number) => {
      const { screenX: startClientX, screenY: startClientY } = await canvasToScreen(startX, startY)
      const { screenX: endClientX, screenY: endClientY } = await canvasToScreen(clientX, clientY)
      return { xDiff: endClientX - startClientX, yDiff: endClientY - startClientY }
    }

    // Move Shape
    if (state.keyDown === 'Shift' && state.shapeMouseDownCoords && state.selectedShape) {
      const { clientX: startX, clientY: startY } = state.shapeMouseDownCoords
      const { xDiff, yDiff } = await getScreenCoordDiff(startX, startY)
      moveShape(state.selectedShape, xDiff, yDiff)
      state.shapeMouseDownCoords = { clientX, clientY }
    }

    // Resize Shape
    if (state.resizeMouseDownCoords) {
      if (!state.selectedShape) return
      const { clientX: startX, clientY: startY, corner } = state.resizeMouseDownCoords
      const { xDiff, yDiff } = await getScreenCoordDiff(startX, startY)
      moveShapeCorner(xDiff, yDiff, state.selectedShape, corner)
      state.resizeMouseDownCoords.clientX = clientX
      state.resizeMouseDownCoords.clientY = clientY
    }

    // Rotate Shape
    if (state.rotateMouseDownCoords) {
      if (!state.selectedShape) return

      // const { clientX: startX, clientY: startY } = state.rotateMouseDownCoords
      const { canvasX: startX, canvasY: startY } = await screenToCanvas(
        state.rotateMouseDownCoords.clientX,
        state.rotateMouseDownCoords.clientY
      )
      const { leftX, topY, rightX, bottomY } = state.selectedShape
      const centerX = leftX + (rightX - leftX) / 2
      const centerY = topY + (bottomY - topY) / 2

      const radians = Math.atan2(startX - centerX, startY - centerY)
      const cornerRadians = Math.atan2(rightX - centerX, topY - centerY)

      state.selectedShape.rotate = -(radians - cornerRadians) + 'rad'

      state.rotateMouseDownCoords.clientX = clientX
      state.rotateMouseDownCoords.clientY = clientY
    }

    state.canvasMouseMoveCoords = { clientX, clientY }
  })

  /**
   *
   * Canvas Mouse Up Event Listener
   *
   */
  const handleCanvasMouseUp = $(async (e: QwikMouseEvent<HTMLSpanElement, MouseEvent>) => {
    const { clientX: endClientX, clientY: endClientY } = e

    // Draw Shape
    if (!state.keyDown && state.canvasMouseDownCoords) {
      const { clientX, clientY } = state.canvasMouseDownCoords
      const mouseMoved = endClientX - clientX !== 0 && endClientY - clientY !== 0

      const { canvasX: leftX, canvasY: topY } = await screenToCanvas(clientX, clientY)
      const { canvasX: rightX, canvasY: bottomY } = await screenToCanvas(endClientX, endClientY)

      mouseMoved
        ? await drawShape({ fillColor: state.selectedColor, leftX, topY, rightX, bottomY })
        : (state.selectedShape = undefined)
    }

    state.canvasMouseMoveCoords = null
    state.canvasMouseDownCoords = null
    state.shapeMouseDownCoords = null
    state.resizeMouseDownCoords = null
    state.rotateMouseDownCoords = null
  })

  /**
   *
   * Preview Style Resource
   *
   */
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
      '--border-radius': state.currShapeType === 'circle' ? '50%' : '0px',
    }
  })

  /**
   *
   *
   *
   */
  const handleFileInput = $((e: QwikChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const file = e.target.files[0]
    const reader = new FileReader()

    const handleErr = () => {
      state.commandText = 'Error loading file'
      setTimeout(() => (state.commandText = ''), 2000)
    }

    reader.onloadend = () => {
      if (!reader?.result) return handleErr()

      const src = reader.result.toString()
      const img = new Image()

      img.onload = async () => {
        const { canvasX, canvasY } = await screenToCanvas(innerWidth / 2, innerHeight / 2)
        const width = img.width / state.scale / 2
        const height = img.height / state.scale / 2

        drawShape({
          fillColor: 'transparent',
          leftX: canvasX - width,
          rightX: width + canvasX,
          topY: canvasY - height,
          bottomY: height + canvasY,
          type: 'image',
          src,
        })
      }
      img.src = src
    }
    file ? reader.readAsDataURL(file) : handleErr()
  })

  /**
   *
   *
   *
   */
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

      console.log(key)

      switch (key) {
        case 'F':
        case 'f':
          state.commandText = 'Bring to Front'
          break
        case 'Backspace':
          state.shapes = state.shapes.filter((shape) => state.selectedShape?.id !== shape.id)
          saveState()
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

  /**
   *
   *
   *
   */
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

  /**
   *
   *
   *
   */
  useOnWindow(
    'wheel',
    $(async (e: any) => {
      e.preventDefault()
      if (!e.metaKey) return

      const zoomPointX = e.clientX - innerWidth / 2
      const zoomPointY = e.clientY - innerHeight / 2

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
        {/* Color Picker */}
        <div class="absolute top-4 left-4 z-10">
          <ColorPicker
            selectedColor={state.selectedColor}
            setSelectedColor={$((color: string) => (state.selectedColor = color))}
          />
        </div>

        <div class="flex gap-1 text-lg text-white absolute bottom-4 left-4 z-10">
          <button
            onClick$={undoState}
            class="h-8 w-8 grid place-items-center border border-slate-700 bg-stone-900 rounded hover:bg-stone-800 transition duration-100"
          >
            <Undo />
          </button>

          <button
            onClick$={redoState}
            class="h-8 w-8 grid place-items-center border border-slate-700 bg-stone-900 rounded hover:bg-stone-800 transition duration-100"
          >
            <Redo />
          </button>

          <button
            class="h-8 px-4 text-xs border border-slate-700 bg-stone-900 rounded hover:bg-stone-800 transition duration-100"
            onClick$={clearShapes}
          >
            Clear
          </button>

          {/* Zoom */}
          <button
            class="h-8 px-4 text-xs border border-slate-700 bg-stone-900 rounded hover:bg-stone-800 transition duration-100"
            onClick$={() => (state.scale = 1)}
          >
            {(state.scale * 100).toFixed(0)}%
          </button>

          {/* Shapes */}
          {[
            { icon: <Rectangle />, shape: 'rectangle', shortcut: 'r' },
            { icon: <Circle />, shape: 'circle', shortcut: 'c' },
            // { icon: <Triangle />, shape: 'triangle', shortcut: 't' },
          ].map(({ icon, shape, shortcut }) => (
            <button
              class={`h-8 px-4 text-xs border border-slate-700 bg-stone-900 rounded relative group hover:bg-stone-800 transition duration-100
            ${state.currShapeType === shape && '!bg-slate-700'}`}
              onClick$={() => (state.currShapeType = shape as State['currShapeType'])}
            >
              {icon}
              <span class="absolute bottom-[-2px] right-[4px] text-[8px] hidden group-hover:block">{shortcut}</span>
            </button>
          ))}

          {/* Image Input */}
          <div
            class={`h-8 px-4 text-xs border border-slate-700 bg-stone-900 rounded relative group hover:bg-stone-800 grid place-items-center
            ${state.currShapeType === 'image' && 'bg-stone-800'}`}
          >
            <input
              type="file"
              onChange$={handleFileInput}
              class="appearance-none absolute max-w-full w-full max-h-full h-full left-0 top-0 cursor-pointer opacity-0"
            />

            <ImageFile />
            <span class="absolute bottom-[-2px] right-[4px] text-[8px] hidden group-hover:block">i</span>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div class="absolute top-4 right-4 z-10">
          <div class="relative text-white">
            <button
              class="px-2 h-8 text-xs border border-slate-700 bg-stone-900 rounded grid place-items-center"
              onClick$={() => (state.showKeyShortcuts = !state.showKeyShortcuts)}
            >
              {state.commandText ? state.commandText : <Keyboard />}
            </button>

            {state.showKeyShortcuts && (
              <div class="absolute right-0 top-[calc(100%+8px)] px-4 w-max text-xs border border-slate-700 rounded">
                {KeyboardCommands.map((shortcut) => (
                  <span class="flex justify-between my-3 w-48">
                    <span>{shortcut.command}</span>{' '}
                    <span class="flex align-center">
                      {shortcut.key.split(' ').map((key) => (
                        <kbd class="ml-1 text-[10px] text-xs leading-[110%] py-[4px] px-[3px] min-w-[20px] inline-grid place-items-center text-center rounded bg-stone-700">
                          {(() => {
                            if (key === '⇧') return <Shift />
                            if (key === '⌘') return <Command />
                            if (key === '⌫') return <Backspace />
                            return key
                          })()}
                        </kbd>
                      ))}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </>

      {/* Canvas */}
      <div
        class="h-screen w-full max-w-screen bg-stone-900 overflow-hidden absolute top-0 left-0 z-0 touch-pan-y touch-pan-x select-none"
        onMouseDown$={handleCanvasMouseDown}
        onMouseMove$={handleCanvasMouseMove}
        onMouseUp$={handleCanvasMouseUp}
        preventdefault:mousedown
        preventdefault:mouseup
      >
        <div
          class="canvas h-full w-full"
          style={{
            transform: 'translate(' + state.zoomPos.x + 'px,' + state.zoomPos.y + 'px) scale(' + state.scale + ')',
          }}
        >
          {/* Drawn Shapes */}
          {state.shapes.map((shape) => {
            const dotSize = 12
            const dotPos = -(dotSize / 2 / state.scale) + 'px'
            const isSelected = state.selectedShape?.id === shape.id
            const height = Math.abs(shape.bottomY - shape.topY || 1)
            const width = Math.abs(shape.rightX - shape.leftX || 1)

            return (
              <>
                <span
                  onClick$={() => handleShapeClick(shape)}
                  onMouseDown$={(e) => handleShapeMouseDown(e, shape)}
                  preventdefault:mousedown
                  class={`shape absolute 
                   ${state.keyDown === 'Shift' && 'cursor-grab active:cursor-grabbing'}
                   ${state.commandText == 'Bring to Front' && 'cursor-crosshair'}`}
                  style={{
                    '--left': shape.leftX + 'px',
                    '--top': shape.topY + 'px',
                    '--height': height + 'px',
                    '--width': width + 'px',
                    '--border-radius': shape.borderRadius,
                    '--rotate': shape.rotate,
                    '--background': shape.fillColor,
                  }}
                >
                  <div class="h-full w-full relative">
                    {shape.type === 'image' && (
                      <img
                        src={shape.src}
                        alt="Shape Image"
                        class="h-full w-full absolute object-contain rounded-[var(--border-radius)]"
                      />
                    )}

                    {isSelected && (
                      <>
                        {/* Selected Border */}
                        <span
                          class="h-full w-full absolute"
                          style={{ border: isSelected ? 1 / state.scale + 'px solid white' : 'none' }}
                        />

                        {/* Resize Dots */}
                        {[
                          { top: dotPos, left: dotPos, cursor: 'nw-resize' },
                          { top: dotPos, right: dotPos, cursor: 'ne-resize' },
                          { bottom: dotPos, left: dotPos, cursor: 'sw-resize' },
                          { bottom: dotPos, right: dotPos, cursor: 'se-resize' },
                        ].map((dotLocation, i) => (
                          <span
                            onMouseDown$={(e) => handleShapeResizeMouseDown(e, i)}
                            class="absolute"
                            style={{
                              height: dotSize / state.scale + 'px',
                              width: dotSize / state.scale + 'px',
                              ...dotLocation,
                            }}
                          />
                        ))}

                        {/* Border Radius Control */}
                        <div
                          class="absolute top-0 bottom-0 m-auto w-2 h-fit transition-opacity"
                          style={{
                            '--slider-width': `8px`,
                            '--slider-height': `clamp(50px, ${height / 2}px, ${(130 + height / 4) * state.scale}px)`,
                            left: `calc(100% + calc(.75rem * ${1 / state.scale}))`,
                            scale: 1 / state.scale,
                            opacity: state.rotateMouseDownCoords ? '0' : '1',
                          }}
                        >
                          <div class="flex justify-center items-center rotate-90 -mb-4">
                            <input
                              style={{ minWidth: `var(--slider-height)` }}
                              class="selected-shape__range cursor-ns-resize outline-none rounded-full bg-gray-700 appearance-none"
                              onMouseDown$={(e) => e.stopPropagation()}
                              type="range"
                              min="0"
                              max="50"
                              step="0.5"
                              value={parseInt(shape.borderRadius)}
                              // @ts-ignore
                              onInput$={(e) => (shape.borderRadius = parseInt(e.target?.value || 0) + '%')}
                            />
                            <output class="text-gray-400 w-4 text-[.65rem] flex items-center justify-between -rotate-90">
                              {shape.borderRadius}
                            </output>
                          </div>
                        </div>

                        {/* Rotate Control */}
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
                              stroke-width="0"
                              viewBox="0 0 256 256"
                              height={20 / state.scale + 'px'}
                              width={20 / state.scale + 'px'}
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
                                ? (parseFloat(shape.rotate) * (180 / Math.PI)).toFixed(1) + 'º'
                                : parseFloat(shape.rotate).toFixed(1) + 'º'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </span>
              </>
            )
          })}

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
