import { $, component$, useOnWindow, useSignal, useStore, useStylesScoped$ } from '@builder.io/qwik'

import type { Shape } from '~/routes'

interface Props {
  selectedShape?: Shape
}

const styles = `
  .shape-controls__slider-slot {
    width: 1.5rem;
    height: 9.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.125rem 0;
  }

  .shape-controls__slider-track {
    position: relative;
    width: 0.875rem;
    height: 100%;
    border-radius: 9999px;
    background-color: rgb(71, 85, 105);
    overflow: visible;
  }

  .shape-controls__slider-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 9999px;
    background: linear-gradient(180deg, rgb(148, 163, 184), rgb(100, 116, 139));
  }

  .shape-controls__slider-thumb {
    position: absolute;
    left: 50%;
    width: 1.125rem;
    height: 1.125rem;
    transform: translateX(-50%);
    border-radius: 9999px;
    background-color: rgb(245, 245, 244);
    border: 2px solid rgb(161, 161, 170);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  }
`

export default component$<Props>(({ selectedShape }) => {
  useStylesScoped$(styles)

  if (!selectedShape || selectedShape.type !== 'rectangle') return <span />

  const sliderRef = useSignal<HTMLDivElement>()
  const state = useStore({ dragging: false })
  const borderRadius = parseFloat(selectedShape.borderRadius) || 0
  const fillPercent = Math.max(0, Math.min(100, (borderRadius / 50) * 100))

  const updateBorderRadius = $((clientY: number) => {
    const slider = sliderRef.value
    if (!slider) return

    const rect = slider.getBoundingClientRect()
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    const nextValue = Math.round(ratio * 100) / 2

    selectedShape.borderRadius = `${nextValue}%`
  })

  useOnWindow(
    'mousemove',
    $((event) => {
      if (!state.dragging) return
      updateBorderRadius((event as MouseEvent).clientY)
    })
  )

  useOnWindow(
    'mouseup',
    $(() => {
      state.dragging = false
    })
  )

  return (
    <div class="absolute bottom-16 left-4 z-10 text-white">
      <div class="rounded-xl border border-slate-700/80 bg-stone-900/95 px-3 py-3 shadow-lg backdrop-blur">
        <div class="flex h-56 w-14 flex-col items-center justify-between">
          <output class="min-w-[3rem] rounded-full bg-stone-800 px-2 py-1 text-center text-[11px] text-slate-300">
            {borderRadius.toFixed(0)}%
          </output>

          <div class="flex flex-1 items-center justify-center py-3">
            <div
              ref={sliderRef}
              aria-label="Border radius"
              aria-valuemax={50}
              aria-valuemin={0}
              aria-valuenow={borderRadius}
              role="slider"
              tabIndex={0}
              class="shape-controls__slider-slot cursor-ns-resize"
              preventdefault:mousedown
              onMouseDown$={(e) => {
                e.stopPropagation()
                state.dragging = true
                updateBorderRadius(e.clientY)
              }}
              onMouseMove$={(e) => {
                if (!state.dragging) return
                updateBorderRadius(e.clientY)
              }}
            >
              <div class="shape-controls__slider-track">
                <div class="shape-controls__slider-fill" style={{ height: `${fillPercent}%` }} />
                <div class="shape-controls__slider-thumb" style={{ bottom: `calc(${fillPercent}% - 9px)` }} />
              </div>
            </div>
          </div>

          <div class="flex flex-col items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
            <span class="block h-[2px] w-6 rounded-full bg-slate-500/60" />
            <span>Radius</span>
          </div>
        </div>
      </div>
    </div>
  )
})
