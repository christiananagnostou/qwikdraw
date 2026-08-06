import { component$, useSignal, useStylesScoped$, useVisibleTask$ } from '@builder.io/qwik'
import type { QRL } from '@builder.io/qwik'

import type { Shape } from '~/routes'

interface Props {
  selectedShape?: Shape
  onCommit?: QRL<() => void>
}

const styles = `
  .shape-controls {
    position: absolute;
    bottom: 4.75rem;
    left: 1rem;
    z-index: 10;
    color: white;
    pointer-events: none;
  }

  .shape-controls__card {
    pointer-events: auto;
    width: 4.5rem;
    border-radius: 0.875rem;
    border: 1px solid rgb(51 65 85 / 0.8);
    background: rgb(28 25 23 / 0.95);
    padding: 0.75rem 0.625rem;
    box-shadow: 0 10px 28px rgb(0 0 0 / 0.28), 0 1px 0 rgb(255 255 255 / 0.04) inset;
    backdrop-filter: blur(10px);
  }

  .shape-controls__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }

  .shape-controls__swatch {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 9999px;
    border: 1px solid rgb(255 255 255 / 0.18);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
  }

  .shape-controls__type {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgb(226 232 240);
    text-align: center;
    line-height: 1.2;
  }

  .shape-controls__divider {
    height: 1px;
    margin: 0 0.25rem 0.75rem;
    background: linear-gradient(90deg, transparent, rgb(71 85 105 / 0.7), transparent);
  }

  .shape-controls__section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .shape-controls__value {
    min-width: 2.75rem;
    border-radius: 9999px;
    background: rgb(41 37 36);
    padding: 0.25rem 0.5rem;
    text-align: center;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: rgb(203 213 225);
  }

  .shape-controls__slider-slot {
    width: 1.75rem;
    height: 8.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
    touch-action: none;
    border-radius: 9999px;
  }

  .shape-controls__slider-slot:focus-visible {
    outline: 2px solid rgb(148 163 184);
    outline-offset: 2px;
  }

  .shape-controls__slider-track {
    position: relative;
    width: 0.75rem;
    height: 100%;
    border-radius: 9999px;
    background-color: rgb(51 65 85);
    overflow: visible;
  }

  .shape-controls__slider-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 9999px;
    background: linear-gradient(180deg, rgb(203 213 225), rgb(100 116 139));
  }

  .shape-controls__slider-thumb {
    position: absolute;
    left: 50%;
    width: 1.125rem;
    height: 1.125rem;
    transform: translateX(-50%);
    border-radius: 9999px;
    background-color: rgb(250 250 249);
    border: 2px solid rgb(161 161 170);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
  }

  .shape-controls__label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgb(148 163 184);
  }

  .shape-controls__hint {
    margin-top: 0.125rem;
    font-size: 11px;
    line-height: 1.35;
    text-align: center;
    color: rgb(148 163 184);
  }
`

const shapeTypeLabel = (type: Shape['type']) => {
  switch (type) {
    case 'rectangle':
      return 'Rectangle'
    case 'circle':
      return 'Circle'
    case 'triangle':
      return 'Triangle'
    case 'image':
      return 'Image'
    default:
      return 'Shape'
  }
}

const shapeHint = (type: Shape['type']) => {
  switch (type) {
    case 'circle':
      return 'Drag corners to scale'
    case 'triangle':
      return 'Drag corners to scale'
    case 'image':
      return 'Drag corners to scale'
    default:
      return ''
  }
}

export default component$<Props>(({ selectedShape, onCommit }) => {
  useStylesScoped$(styles)

  if (!selectedShape || selectedShape.type === 'image') return <span />

  const sliderRef = useSignal<HTMLDivElement>()
  const borderRadius = parseFloat(selectedShape.borderRadius) || 0
  const fillPercent = Math.max(0, Math.min(100, (borderRadius / 50) * 100))
  const showRadius = selectedShape.type === 'rectangle'
  const typeLabel = shapeTypeLabel(selectedShape.type)
  const hint = shapeHint(selectedShape.type)

  useVisibleTask$(({ cleanup, track }) => {
    track(() => selectedShape.id)
    track(() => selectedShape.type)

    const slider = sliderRef.value
    if (!slider || selectedShape.type !== 'rectangle') return

    let dragging = false
    let changed = false

    const updateBorderRadius = (clientY: number) => {
      const rect = slider.getBoundingClientRect()
      const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
      const nextValue = Math.round(ratio * 100) / 2

      if (`${nextValue}%` !== selectedShape.borderRadius) {
        selectedShape.borderRadius = `${nextValue}%`
        changed = true
      }
    }

    const stopDragging = () => {
      if (!dragging) return
      dragging = false
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
      window.removeEventListener('blur', stopDragging)

      if (changed) {
        changed = false
        if (onCommit) onCommit()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging) return
      if (event.pointerType === 'mouse' && event.buttons === 0) {
        stopDragging()
        return
      }
      updateBorderRadius(event.clientY)
    }

    const handlePointerDown = (event: PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      dragging = true
      changed = false
      slider.setPointerCapture?.(event.pointerId)
      updateBorderRadius(event.clientY)
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', stopDragging)
      window.addEventListener('pointercancel', stopDragging)
      window.addEventListener('blur', stopDragging)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const current = parseFloat(selectedShape.borderRadius) || 0
      const step = event.shiftKey ? 5 : 1
      let next = current

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          next = Math.min(50, current + step)
          break
        case 'ArrowDown':
        case 'ArrowLeft':
          next = Math.max(0, current - step)
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = 50
          break
        case 'PageUp':
          next = Math.min(50, current + 10)
          break
        case 'PageDown':
          next = Math.max(0, current - 10)
          break
        default:
          return
      }

      event.preventDefault()
      event.stopPropagation()

      if (`${next}%` !== selectedShape.borderRadius) {
        selectedShape.borderRadius = `${next}%`
        if (onCommit) onCommit()
      }
    }

    slider.addEventListener('pointerdown', handlePointerDown)
    slider.addEventListener('keydown', handleKeyDown)

    cleanup(() => {
      slider.removeEventListener('pointerdown', handlePointerDown)
      slider.removeEventListener('keydown', handleKeyDown)
      stopDragging()
    })
  })

  return (
    <div class="shape-controls">
      <div class="shape-controls__card">
        <div class="shape-controls__header">
          <span
            class="shape-controls__swatch"
            style={{ background: selectedShape.fillColor }}
            aria-hidden="true"
          />
          <span class="shape-controls__type">{typeLabel}</span>
        </div>

        {showRadius ? (
          <>
            <div class="shape-controls__divider" aria-hidden="true" />
            <div class="shape-controls__section">
              <output class="shape-controls__value" for="shape-border-radius">
                {borderRadius.toFixed(0)}%
              </output>

              <div
                ref={sliderRef}
                id="shape-border-radius"
                aria-label="Border radius"
                aria-valuemax={50}
                aria-valuemin={0}
                aria-valuenow={borderRadius}
                aria-valuetext={`${borderRadius.toFixed(0)} percent`}
                role="slider"
                tabIndex={0}
                class="shape-controls__slider-slot cursor-ns-resize"
              >
                <div class="shape-controls__slider-track">
                  <div class="shape-controls__slider-fill" style={{ height: `${fillPercent}%` }} />
                  <div class="shape-controls__slider-thumb" style={{ bottom: `calc(${fillPercent}% - 9px)` }} />
                </div>
              </div>

              <span class="shape-controls__label">Radius</span>
            </div>
          </>
        ) : (
          <p class="shape-controls__hint">{hint}</p>
        )}
      </div>
    </div>
  )
})
