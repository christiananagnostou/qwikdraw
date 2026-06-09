import { $, component$ } from '@builder.io/qwik'
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
import { Undo } from '../icons/undo'

const chromeButtonClass =
  'border border-slate-700 bg-stone-900 rounded hover:bg-stone-800 transition duration-100'
const iconButtonClass = `h-8 w-8 grid place-items-center ${chromeButtonClass}`
const textButtonClass = `h-8 px-4 text-xs ${chromeButtonClass}`
const shapeButtonClass = `h-8 px-4 text-xs ${chromeButtonClass} relative group`

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
  { key: 'i', command: 'Image' },
] as const

const shapeButtons = [
  { icon: <Rectangle />, shape: 'rectangle' as ShapeType, shortcut: 'r' },
  { icon: <Circle />, shape: 'circle' as ShapeType, shortcut: 'c' },
] as const

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
    const handleFileInput = $((e: QwikChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return

      const file = e.target.files[0]
      const reader = new FileReader()

      const handleErr = () => {
        state.commandText = 'Error loading file'
        setTimeout(() => (state.commandText = ''), 2000)
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

    const renderShortcutKey = (key: string) => {
      if (key === '⇧') return <Shift />
      if (key === '⌘') return <Command />
      if (key === '⌫') return <Backspace />
      return key
    }

    return (
      <>
        <div class="absolute top-4 left-4 z-10">
          <ColorPicker selectedColor={state.selectedColor} setSelectedColor={setSelectedColor} />
        </div>

        <div class="flex gap-1 text-lg text-white absolute bottom-4 left-4 z-10">
          <button onClick$={onUndo} class={iconButtonClass}>
            <Undo />
          </button>

          <button onClick$={onRedo} class={iconButtonClass}>
            <Redo />
          </button>

          <button class={textButtonClass} onClick$={onClear}>
            Clear
          </button>

          <button class={textButtonClass} onClick$={onResetZoom}>
            {(state.scale * 100).toFixed(0)}%
          </button>

          {shapeButtons.map(({ icon, shape, shortcut }) => (
            <button
              key={shape}
              class={`${shapeButtonClass} ${
                state.currShapeType === shape ? '!bg-slate-700' : ''
              }`}
              onClick$={() => onSelectShapeType(shape)}
            >
              {icon}
              <span class="absolute bottom-[-2px] right-[4px] text-[8px] hidden group-hover:block">{shortcut}</span>
            </button>
          ))}

          <div
            class={`${shapeButtonClass} grid place-items-center ${
              state.currShapeType === 'image' ? 'bg-stone-800' : ''
            }`}
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
                {keyboardCommands.map((shortcut) => (
                  <span key={`${shortcut.command}-${shortcut.key}`} class="flex justify-between my-3 w-48">
                    <span>{shortcut.command}</span>
                    <span class="flex align-center">
                      {shortcut.key.split(' ').map((key) => (
                        <kbd
                          key={`${shortcut.command}-${key}`}
                          class="ml-1 text-[10px] text-xs leading-[110%] py-[4px] px-[3px] min-w-[20px] inline-grid place-items-center text-center rounded bg-stone-700"
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
