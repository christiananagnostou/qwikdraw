import type { QRL } from '@builder.io/qwik'
import { useTask$, useStore, useOnDocument } from '@builder.io/qwik'
import { component$, $ } from '@builder.io/qwik'

export const Colors = [
  'rgb(255,0,0)',
  'rgb(255,0,255)',
  'rgb(0,0,255)',
  'rgb(0,255,255)',
  'rgb(0,255,0)',
  'rgb(255,255,0)',
  'rgb(255,0,0)',
]

interface Props {
  selectedColor: string
  baseColor: string
  setSelectedColor: QRL<(color: string) => string>
  setBaseColor: QRL<(color: string) => string>
}

export default component$<Props>(({ selectedColor, baseColor, setSelectedColor, setBaseColor }) => {
  const state = useStore({
    showColorPicker: false,
    palatePercentX: 50,
    palatePercentY: 50,
    barPercentX: 0,
    mouseDownPalate: false,
    mouseDownBar: false,
  })

  const handlePalateMouseEvent = $((e: any, skipMouseDown?: boolean) => {
    if (!state.mouseDownPalate && !skipMouseDown) return

    const { offsetX, offsetY } = e
    const { scrollWidth, scrollHeight } = e.target
    const percentX = offsetX / scrollWidth
    const percentY = offsetY / scrollHeight

    const [baseR, baseG, baseB] = baseColor.slice(baseColor.indexOf('(') + 1, -1).split(',')

    // (Max - (percentX * baseXDiff)) * (lightness percent)
    const r = (255 - percentX * (255 - parseInt(baseR))) * (1 - percentY)
    const g = (255 - percentX * (255 - parseInt(baseG))) * (1 - percentY)
    const b = (255 - percentX * (255 - parseInt(baseB))) * (1 - percentY)

    setSelectedColor(`rgb(${[r, g, b]})`)

    state.palatePercentX = percentX * 100
    state.palatePercentY = percentY * 100
  })

  const handleColorBarEvent = $((e: any, skipMouseDown?: boolean) => {
    if (!state.mouseDownBar && !skipMouseDown) return

    const { offsetX } = e
    const { scrollWidth } = e.target

    const factor = 100 / 3
    const percentX = Math.max(Math.min(99.99, (offsetX / scrollWidth) * 100), 0)

    const sigmoid = Math.round(((percentX % factor) / factor) * 2 * 255)
    const segment = Math.floor(percentX / factor)

    const rgb = [0, 0, 0]
    rgb[2 - segment] = Math.min(sigmoid, 255) // Ascending sigmoid
    rgb[[0, 2, 1][segment]] = 255 - Math.max(0, sigmoid - 255) // Descing sigmoid

    setBaseColor(`rgb(${rgb})`)
    state.barPercentX = percentX
  })

  // useTask$(({ track }) => {
  //   const color = track(() => selectedColor)
  //   console.log(color)
  // })

  useOnDocument(
    'mouseup',
    $(() => {
      state.mouseDownBar = false
      state.mouseDownPalate = false
    })
  )

  return (
    <div class="flex flex-col gap-1">
      <button
        style={{ background: selectedColor }}
        onClick$={() => (state.showColorPicker = !state.showColorPicker)}
        class="h-8 w-8 rounded"
      />

      {state.showColorPicker && (
        <div class="relative bg-slate-700 shadow-lg p-[2px] rounded-md">
          {/* Color Palate */}
          <div
            class="relative w-[200px] h-[200px] rounded overflow-hidden"
            onMouseDown$={() => (state.mouseDownPalate = true)}
            onMouseUp$={() => (state.mouseDownPalate = false)}
            onMouseMove$={(e) => handlePalateMouseEvent(e, false)}
            onClick$={(e) => handlePalateMouseEvent(e, true)}
          >
            <div class="absolute inset w-full h-full" style={{ background: baseColor }}>
              <div
                class="absolute inset-0"
                style="background: linear-gradient(to right, rgb(255, 255, 255), rgba(255, 255, 255, 0));"
              >
                <div
                  class="absolute inset-0"
                  style="background: linear-gradient(to top, rgb(0, 0, 0), rgba(0, 0, 0, 0));"
                ></div>

                {/* Cursor */}
                <div
                  class="absolute cursor-default pointer-events-none"
                  style={{ top: state.palatePercentY + '%', left: state.palatePercentX + '%' }}
                >
                  <div
                    class="w-1 h-1 rounded-full"
                    style="
                    transform: translate(-2px, -2px);
                    box-shadow: rgb(255, 255, 255) 0px 0px 0px 1px, rgba(0, 0, 0, 0.3) 0px 0px 1px 1px inset, rgba(0, 0, 0, 0.4) 0px 0px 1px 2px;"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Color Bar */}
          <div
            class="mt-[2px] w-full"
            onMouseDown$={() => (state.mouseDownBar = true)}
            onMouseUp$={() => (state.mouseDownBar = false)}
            onMouseMove$={(e) => handleColorBarEvent(e, false)}
            onClick$={(e) => handleColorBarEvent(e, true)}
          >
            <div
              class="w-full h-6 rounded overflow-hidden relative"
              style={`background: linear-gradient(to right, ${Colors})`}
            >
              <span
                class="h-full w-[2px] bg-white absolute pointer-events-none"
                style={{ left: state.barPercentX + '%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
