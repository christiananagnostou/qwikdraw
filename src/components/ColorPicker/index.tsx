import { $, component$, useOnDocument, useSignal, useStore, useTask$, useVisibleTask$ } from '@builder.io/qwik'
import type { QRL } from '@builder.io/qwik'

const Colors = [
  'rgb(255,0,0)',
  'rgb(255,0,255)',
  'rgb(0,0,255)',
  'rgb(0,255,255)',
  'rgb(0,255,0)',
  'rgb(255,255,0)',
  'rgb(255,0,0)',
]

const Palate = {
  height: 200,
  width: 200,
}

interface Props {
  selectedColor: string
  setSelectedColor: QRL<(color: string) => void>
}

export default component$<Props>(({ selectedColor, setSelectedColor }) => {
  const palateRef = useSignal<HTMLDivElement>()
  const colorBarRef = useSignal<HTMLDivElement>()

  const state = useStore({
    showColorPicker: false,
    baseColor: [0, 0, 0],
    palatePercentX: 100,
    palatePercentY: 0,
    barPercentX: 0,
    mouseDownPalate: false,
    mouseDownBar: false,
  })

  const calcPalateColor = $((percentX: number, percentY: number) => {
    const rgb = state.baseColor.map((val) => (255 - (percentX / 100) * (255 - val)) * (1 - percentY / 100))
    setSelectedColor(`rgb(${rgb})`)
  })

  const calcBarColor = $((percentX: number) => {
    percentX = Math.max(Math.min(99.99, percentX), 0)
    const segmentSize = 100 / 3

    const segmentFactor = Math.round(((percentX % segmentSize) / segmentSize) * 2 * 255)
    const segment = Math.floor(percentX / segmentSize)

    const rgb = [0, 0, 0]
    rgb[2 - segment] = Math.min(segmentFactor, 255)
    rgb[[0, 2, 1][segment]] = 255 - Math.max(0, segmentFactor - 255)

    state.baseColor = rgb
  })

  useTask$(() => {
    const [r, g, b] = selectedColor
      .substring(selectedColor.indexOf('(') + 1, selectedColor.indexOf(')'))
      .split(',')
      .map((t) => parseInt(t))

    const rgbObj = { r, g, b }

    const [first, second, third] = Object.entries(rgbObj).sort((a, b) => b[1] - a[1]) as ['r' | 'g' | 'b', number][]

    const ratioOfSecond = (1 / (first[1] / 255)) * second[1]
    const ratioOfThird = (1 / (first[1] / 255)) * third[1]

    const dropBoth = second[1] === third[1]

    rgbObj[second[0]] = dropBoth ? 0 : ratioOfThird > 0 ? (ratioOfSecond + ratioOfThird) / 2 : ratioOfSecond
    rgbObj[first[0]] = 255
    rgbObj[third[0]] = 0

    state.baseColor = Object.values(rgbObj)

    const segments = { r: 0, g: 66.66, b: 33.33 }
    state.barPercentX = segments[first[0]] + (second[1] / 255) * (100 / 3)
  })

  useTask$(({ track }) => {
    track(() => state.baseColor)
    calcPalateColor(state.palatePercentX, state.palatePercentY)
  })

  useOnDocument(
    'mouseup',
    $(() => {
      state.mouseDownBar = false
      state.mouseDownPalate = false
    })
  )

  useVisibleTask$(({ cleanup, track }) => {
    track(() => state.showColorPicker)

    const palateEl = palateRef.value
    const colorBarEl = colorBarRef.value

    if (!state.showColorPicker || !palateEl || !colorBarEl) return

    const updatePalate = (e: MouseEvent) => {
      const rect = palateEl.getBoundingClientRect()
      const percentX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / Palate.width) * 100))
      const percentY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / Palate.height) * 100))

      calcPalateColor(percentX, percentY)
      state.palatePercentX = percentX
      state.palatePercentY = percentY
    }

    const updateColorBar = (e: MouseEvent) => {
      const rect = colorBarEl.getBoundingClientRect()
      const percentX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / (rect.width || 1)) * 100))

      calcBarColor(percentX)
      state.barPercentX = percentX
    }

    const handlePalateMouseDown = (e: MouseEvent) => {
      state.mouseDownPalate = true
      updatePalate(e)
    }

    const handlePalateMouseMove = (e: MouseEvent) => {
      if (!state.mouseDownPalate) return
      updatePalate(e)
    }

    const handlePalateClick = (e: MouseEvent) => {
      updatePalate(e)
    }

    const handleColorBarMouseDown = (e: MouseEvent) => {
      state.mouseDownBar = true
      updateColorBar(e)
    }

    const handleColorBarMouseMove = (e: MouseEvent) => {
      if (!state.mouseDownBar) return
      updateColorBar(e)
    }

    const handleColorBarClick = (e: MouseEvent) => {
      updateColorBar(e)
    }

    palateEl.addEventListener('mousedown', handlePalateMouseDown)
    palateEl.addEventListener('mousemove', handlePalateMouseMove)
    palateEl.addEventListener('click', handlePalateClick)

    colorBarEl.addEventListener('mousedown', handleColorBarMouseDown)
    colorBarEl.addEventListener('mousemove', handleColorBarMouseMove)
    colorBarEl.addEventListener('click', handleColorBarClick)

    cleanup(() => {
      palateEl.removeEventListener('mousedown', handlePalateMouseDown)
      palateEl.removeEventListener('mousemove', handlePalateMouseMove)
      palateEl.removeEventListener('click', handlePalateClick)

      colorBarEl.removeEventListener('mousedown', handleColorBarMouseDown)
      colorBarEl.removeEventListener('mousemove', handleColorBarMouseMove)
      colorBarEl.removeEventListener('click', handleColorBarClick)
    })
  })

  return (
    <div class="flex flex-col gap-1">
      <button
        style={{ background: selectedColor }}
        onClick$={() => (state.showColorPicker = !state.showColorPicker)}
        class="h-8 w-8 rounded"
        title="Pick a color"
      />

      {state.showColorPicker && (
        <div class="relative bg-slate-700 shadow-lg p-[2px] rounded-md">
          <div
            ref={palateRef}
            class="relative rounded overflow-hidden"
            style={{ height: Palate.height + 'px', width: Palate.width + 'px' }}
          >
            <div class="absolute inset w-full h-full" style={{ background: `rgb(${state.baseColor})` }}>
              <div
                class="absolute inset-0"
                style="background: linear-gradient(to right, rgb(255, 255, 255), rgba(255, 255, 255, 0));"
              >
                <div
                  class="absolute inset-0"
                  style="background: linear-gradient(to top, rgb(0, 0, 0), rgba(0, 0, 0, 0));"
                ></div>

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

          <div ref={colorBarRef} class="mt-[2px] w-full">
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
