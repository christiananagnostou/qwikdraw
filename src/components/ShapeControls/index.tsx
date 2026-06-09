import { component$ } from '@builder.io/qwik'

import type { Shape } from '~/routes'

interface Props {
  selectedShape?: Shape
}

export default component$<Props>(({ selectedShape }) => {
  if (!selectedShape || selectedShape.type !== 'rectangle') return <span />

  const borderRadius = parseFloat(selectedShape.borderRadius) || 0

  return (
    <div class="absolute bottom-16 left-4 z-10 text-white">
      <div class="rounded-[2rem] border border-slate-700/80 bg-stone-900/95 px-3 py-3 shadow-lg backdrop-blur">
        <div class="flex h-56 w-14 flex-col items-center justify-between">
          <output class="min-w-[3rem] rounded-full bg-stone-800 px-2 py-1 text-center text-[11px] text-slate-300">
            {borderRadius.toFixed(0)}%
          </output>

          <div class="flex flex-1 items-center justify-center py-3">
            <input
              aria-label="Border radius"
              class="selected-shape__range selected-shape__range--vertical cursor-ns-resize outline-none appearance-none"
              onMouseDown$={(e) => e.stopPropagation()}
              style={{ '--slider-width': '18px' }}
              type="range"
              min="0"
              max="50"
              step="0.5"
              value={borderRadius}
              onInput$={(e) => {
                selectedShape.borderRadius = `${parseFloat((e.target as HTMLInputElement).value || '0')}%`
              }}
            />
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
