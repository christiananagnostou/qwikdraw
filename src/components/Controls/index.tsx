import { $, component$, useSignal } from '@builder.io/qwik'
import type { QRL, QwikChangeEvent } from '@builder.io/qwik'

import type { DrawShapeInput, ShapeType, State } from '~/routes'

import ColorPicker from '../ColorPicker'
import { Backspace } from '../icons/backspace'
import { Circle } from '../icons/circle'
import { Command } from '../icons/command'
import { ImageFile } from '../icons/imageFile'
import { Keyboard } from '../icons/keyboard'
import { Redo } from '../icons/redo'
import { Rectangle } from '../icons/retangle'
import { Shift } from '../icons/shift'
import { Triangle } from '../icons/triangle'
import { Undo } from '../icons/undo'

const chromeSurface =
  'border border-slate-700/80 bg-stone-900/95 shadow-lg shadow-black/20 backdrop-blur-sm'
const iconButtonClass = `h-9 w-9 grid place-items-center rounded-lg ${chromeSurface} text-slate-200 hover:bg-stone-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 transition-colors duration-150`
const textButtonClass = `h-9 px-3 text-xs font-medium tracking-wide rounded-lg ${chromeSurface} text-slate-200 hover:bg-stone-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 transition-colors duration-150`
const clusterClass = `flex items-center gap-0.5 rounded-xl p-0.5 ${chromeSurface}`

const keyboardCommands = [
  { key: '⇧ Click', command: 'Move' },
  { key: 'F Click', command: 'Bring to Front' },
  { key: '⌘ Scroll', command: 'Zoom' },
  { key: 'Space Drag', command: 'Pan' },
  { key: '⌘ Z', command: 'Undo' },
  { key: '⇧ ⌘ Z', command: 'Redo' },
  { key: '⌫', command: 'Delete' },
  { key: 'c', command: 'Circle' },
  { key: 'r', command: 'Rectangle' },
  { key: 't', command: 'Triangle' },
  { key: 'i', command: 'Image' },
] as const

const shapeButtons = [
  { icon: <Rectangle />, shape: 'rectangle' as ShapeType, shortcut: 'R', label: 'Rectangle' },
  { icon: <Circle />, shape: 'circle' as ShapeType, shortcut: 'C', label: 'Circle' },
  { icon: <Triangle />, shape: 'triangle' as ShapeType, shortcut: 'T', label: 'Triangle' },
] as const

const shapeLabels: Record<ShapeType, string> = {
  rectangle: 'Rectangle',
  circle: 'Circle',
  triangle: 'Triangle',
  image: 'Image',
}

interface Props {
  state: State
  onUndo: QRL<() => void>
  onRedo: QRL<() => void>
  onClear: QRL<() => void>
  onResetZoom: QRL<() => void>
  onSelectShapeType: QRL<(shapeType: ShapeType) => void>
  setSelectedColor: QRL<(color: string) => void>
  drawShape: QRL<(props: DrawShapeInput) => Promise<void>>
  screenToCanvas: QRL<(screenX: number, screenY: number) => Promise<{ canvasX: number; canvasY: number }>>
}

export default component$(
  ({
    state,
    onUndo,
    onRedo,
    onClear,
    onResetZoom,
    onSelectShapeType,
    setSelectedColor,
    drawShape,
    screenToCanvas,
  }: Props) => {
    const fileInputRef = useSignal<HTMLInputElement>()
    const clearArmed = useSignal(false)

    const handleFileInput = $((e: QwikChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return

      const file = e.target.files[0]
      const reader = new FileReader()

      const handleErr = () => {
        state.commandText = 'Error loading file'
        setTimeout(() => {
          if (state.commandText === 'Error loading file') state.commandText = ''
        }, 2000)
      }

      reader.onloadend = () => {
        if (!reader.result) return handleErr()

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

    const handleClear = $(() => {
      if (state.shapes.length === 0) return

      if (!clearArmed.value) {
        clearArmed.value = true
        state.commandText = 'Click Clear again'
        setTimeout(() => {
          clearArmed.value = false
          if (state.commandText === 'Click Clear again') state.commandText = ''
        }, 2500)
        return
      }

      clearArmed.value = false
      onClear()
      state.commandText = 'Cleared · ⌘Z to undo'
      setTimeout(() => {
        if (state.commandText === 'Cleared · ⌘Z to undo') state.commandText = ''
      }, 2500)
    })

    const renderShortcutKey = (key: string) => {
      if (key === '⇧') return <Shift />
      if (key === '⌘') return <Command />
      if (key === '⌫') return <Backspace />
      return key
    }

    const activeToolLabel = shapeLabels[state.currShapeType]
    const statusMessage = state.commandText || activeToolLabel

    return (
      <>
        <div class="pointer-events-none absolute top-4 left-4 z-10 flex items-start gap-2">
          <div class="pointer-events-auto">
            <ColorPicker selectedColor={state.selectedColor} setSelectedColor={setSelectedColor} />
          </div>
          <div
            class={`mt-0.5 flex h-9 items-center gap-2 rounded-lg px-3 ${chromeSurface}`}
            aria-live="polite"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              style={{ background: state.currShapeType === 'image' ? 'rgb(148, 163, 184)' : state.selectedColor }}
            />
            <span class="text-xs font-medium tracking-wide text-slate-200">{statusMessage}</span>
          </div>
        </div>

        <div class="pointer-events-none absolute bottom-4 left-4 z-10 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 text-white">
          <div class={`${clusterClass} pointer-events-auto`} role="group" aria-label="History">
            <button type="button" aria-label="Undo" title="Undo (⌘Z)" onClick$={onUndo} class={iconButtonClass}>
              <Undo />
            </button>
            <button type="button" aria-label="Redo" title="Redo (⇧⌘Z)" onClick$={onRedo} class={iconButtonClass}>
              <Redo />
            </button>
            <button
              type="button"
              aria-label={clearArmed.value ? 'Confirm clear canvas' : 'Clear canvas'}
              title={clearArmed.value ? 'Click again to clear' : 'Clear'}
              class={`${textButtonClass} ${clearArmed.value ? '!border-rose-500/60 !text-rose-200' : ''}`}
              onClick$={handleClear}
            >
              {clearArmed.value ? 'Confirm' : 'Clear'}
            </button>
          </div>

          <div class={`${clusterClass} pointer-events-auto`} role="group" aria-label="View">
            <button
              type="button"
              aria-label={`Reset zoom, currently ${(state.scale * 100).toFixed(0)} percent`}
              title="Reset zoom"
              class={`${textButtonClass} min-w-[3.25rem] tabular-nums`}
              onClick$={onResetZoom}
            >
              {(state.scale * 100).toFixed(0)}%
            </button>
          </div>

          <div class={`${clusterClass} pointer-events-auto gap-0`} role="radiogroup" aria-label="Drawing tools">
            {shapeButtons.map(({ icon, shape, shortcut, label }) => {
              const isActive = state.currShapeType === shape
              return (
                <button
                  key={shape}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`${label} tool (${shortcut})`}
                  title={`${label} (${shortcut.toLowerCase()})`}
                  class={`relative grid h-9 w-9 place-items-center rounded-lg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                    isActive
                      ? 'bg-slate-100 text-stone-900 shadow-sm'
                      : 'text-slate-300 hover:bg-stone-800 hover:text-white'
                  }`}
                  onClick$={() => onSelectShapeType(shape)}
                >
                  {icon}
                  <kbd
                    class={`pointer-events-none absolute bottom-0.5 right-1 text-[10px] font-medium leading-none ${
                      isActive ? 'text-stone-500' : 'text-slate-500'
                    }`}
                  >
                    {shortcut.toLowerCase()}
                  </kbd>
                </button>
              )
            })}

            <button
              type="button"
              role="radio"
              aria-checked={state.currShapeType === 'image'}
              aria-label="Insert image (I)"
              title="Insert image (i)"
              class={`relative grid h-9 w-9 place-items-center rounded-lg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                state.currShapeType === 'image'
                  ? 'bg-slate-100 text-stone-900 shadow-sm'
                  : 'text-slate-300 hover:bg-stone-800 hover:text-white'
              }`}
              onClick$={() => {
                state.currShapeType = 'image'
                fileInputRef.value?.click()
              }}
            >
              <ImageFile />
              <kbd
                class={`pointer-events-none absolute bottom-0.5 right-1 text-[10px] font-medium leading-none ${
                  state.currShapeType === 'image' ? 'text-stone-500' : 'text-slate-500'
                }`}
              >
                i
              </kbd>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange$={handleFileInput}
              class="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>

        <div class="pointer-events-none absolute top-4 right-4 z-10">
          <div class="pointer-events-auto relative text-white">
            <button
              type="button"
              aria-label="Keyboard shortcuts"
              aria-expanded={state.showKeyShortcuts}
              title="Keyboard shortcuts"
              class={`grid h-9 place-items-center rounded-lg px-2.5 text-xs ${chromeSurface} text-slate-200 hover:bg-stone-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 transition-colors duration-150`}
              onClick$={() => (state.showKeyShortcuts = !state.showKeyShortcuts)}
            >
              <Keyboard />
            </button>

            {state.showKeyShortcuts && (
              <div
                class={`absolute right-0 top-[calc(100%+8px)] w-max rounded-xl px-4 py-1 text-xs ${chromeSurface}`}
                role="dialog"
                aria-label="Keyboard shortcuts"
              >
                {keyboardCommands.map((shortcut) => (
                  <span key={`${shortcut.command}-${shortcut.key}`} class="flex w-52 justify-between my-2.5">
                    <span class="text-slate-300">{shortcut.command}</span>
                    <span class="flex items-center">
                      {shortcut.key.split(' ').map((key) => (
                        <kbd
                          key={`${shortcut.command}-${key}`}
                          class="ml-1 inline-grid min-w-[1.25rem] place-items-center rounded-md bg-stone-800 px-1.5 py-1 text-center text-[11px] leading-none text-slate-200"
                        >
                          {renderShortcutKey(key)}
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
    )
  }
)
