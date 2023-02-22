import { $, component$, type QwikMouseEvent, useStore, useStylesScoped$, useTask$ } from '@builder.io/qwik'
import { type DocumentHead } from '@builder.io/qwik-city'
import Canvas from '~/models/ascii/canvas'
import styles from './ascii.css?inline'

export const WIDTH = 20
export const HEIGHT = 20

export const canvas = new Canvas(HEIGHT, WIDTH)

export default component$(() => {
  useStylesScoped$(styles)

  const state = useStore({
    command: '',
    grid: canvas.createGrid(),
    width: WIDTH,
    height: HEIGHT,
    mouseDownCoords: null as { row: number; col: number } | null,
    draggingCoords: null as { row: number; col: number } | null,
    selectedColor: 'red',
  })

  useTask$(({ track }) => {
    const width = track(() => state.width)
    const height = track(() => state.height)
    canvas.resize(height, width)
    state.grid = canvas.createGrid()
  })

  const handleMouseDown = $((e: QwikMouseEvent<HTMLSpanElement, MouseEvent>, elem: HTMLSpanElement) => {
    const { row, col } = elem.dataset
    if (row && col) {
      const coords = { row: Number(row), col: Number(col) }
      e.shiftKey ? (state.draggingCoords = coords) : (state.mouseDownCoords = coords)
    }
  })

  const handleMouseUp = $((_: QwikMouseEvent<HTMLSpanElement, MouseEvent>, elem: HTMLSpanElement) => {
    const { row: endRow, col: endCol } = elem.dataset
    if (!endCol || !endRow) return

    if (state.draggingCoords) {
      const { row, col } = state.draggingCoords
      canvas.dragAndDrop(col, row, Number(endCol), Number(endRow))
    }
    if (state.mouseDownCoords) {
      const { row, col } = state.mouseDownCoords
      canvas.drawRectangle(state.selectedColor, col, row, Number(endCol), Number(endRow))
    }

    state.grid = canvas.createGrid()
    state.mouseDownCoords = null
    state.draggingCoords = null
  })

  const handleUndo = $(() => {
    canvas.undoState()
    state.grid = canvas.createGrid()
  })

  const handleRedo = $(() => {
    canvas.redoState()
    state.grid = canvas.createGrid()
  })

  return (
    <>
      <label for="columns">
        Columns:
        <input
          type="range"
          value={state.width}
          min={1}
          max={20}
          onInput$={(ev) => {
            state.width = (ev.target as HTMLInputElement).valueAsNumber
          }}
        />
      </label>
      <label for="rows">
        Rows:
        <input
          id="rows"
          type="range"
          value={state.height}
          min={1}
          max={100}
          onInput$={(ev) => {
            state.height = (ev.target as HTMLInputElement).valueAsNumber
          }}
        />
      </label>

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
          <button onClick$={handleUndo} class="p-[.15rem] border border-slate-700 rounded">
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

          <button onClick$={handleRedo} class="p-[.15rem] border border-slate-700 rounded">
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
        </div>
      </div>

      <div class="canvas" style={{ '--columns': state.width, '--rows': state.height }}>
        {state.grid.map((row, i) =>
          row.map((col, j) => (
            <span
              class="cell"
              style={{ '--color': col || 'white' }}
              onMouseDown$={handleMouseDown}
              onMouseUp$={handleMouseUp}
              preventdefault:mousedown
              preventdefault:mouseup
              data-row={i}
              data-col={j}
            />
          ))
        )}
      </div>
    </>
  )
})

export const head: DocumentHead = {
  title: 'Qwik Ascii',
}
