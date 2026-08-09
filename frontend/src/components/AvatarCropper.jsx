import { useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, MinusSignIcon, PlusSignIcon } from '@hugeicons/core-free-icons'

const VIEWPORT = 288
const OUTPUT_SIZE = 512
const MIN_ZOOM = 1
const MAX_ZOOM = 4

/**
 * Square-crop editor for a picked image file.
 *
 * The image is laid out in a fixed square viewport at `baseScale * zoom`, where
 * `baseScale` is whatever makes it *cover* the viewport — so the crop area can
 * never contain empty space, and the offset is clamped to enforce that on every
 * drag and zoom. Saving maps the viewport rect back into source pixels and
 * redraws it into a fixed-size canvas.
 */
export default function AvatarCropper({ file, onCancel, onSave }) {
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const dragState = useRef(null)
  const baseScale = image
    ? Math.max(VIEWPORT / image.naturalWidth, VIEWPORT / image.naturalHeight)
    : 1
  const scale = baseScale * zoom

  const clampOffset = useCallback(
    (next, currentScale, img) => {
      if (!img) return { x: 0, y: 0 }
      const width = img.naturalWidth * currentScale
      const height = img.naturalHeight * currentScale
      // Left/top can't go positive and right/bottom can't pull inside the
      // viewport — together that's "the image always covers the crop area".
      const minX = Math.min(0, VIEWPORT - width)
      const minY = Math.min(0, VIEWPORT - height)
      return {
        x: Math.min(0, Math.max(minX, next.x)),
        y: Math.min(0, Math.max(minY, next.y)),
      }
    },
    []
  )

  useEffect(() => {
    if (!file) return undefined

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const initialScale = Math.max(
        VIEWPORT / img.naturalWidth,
        VIEWPORT / img.naturalHeight
      )
      setImage(img)
      setZoom(1)
      // Start centred.
      setOffset({
        x: (VIEWPORT - img.naturalWidth * initialScale) / 2,
        y: (VIEWPORT - img.naturalHeight * initialScale) / 2,
      })
    }
    img.onerror = () => setError("That file couldn't be read as an image.")
    img.src = objectUrl

    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onCancel])

  const applyZoom = (nextZoom) => {
    if (!image) return
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
    const nextScale = baseScale * clampedZoom
    // Keep the viewport centre pinned while zooming, otherwise the image
    // appears to drift toward its top-left corner.
    const centreX = (VIEWPORT / 2 - offset.x) / scale
    const centreY = (VIEWPORT / 2 - offset.y) / scale
    const nextOffset = {
      x: VIEWPORT / 2 - centreX * nextScale,
      y: VIEWPORT / 2 - centreY * nextScale,
    }
    setZoom(clampedZoom)
    setOffset(clampOffset(nextOffset, nextScale, image))
  }

  const handlePointerDown = (event) => {
    if (!image) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    }
  }

  const handlePointerMove = (event) => {
    if (!dragState.current || !image) return
    const { startX, startY, originX, originY } = dragState.current
    setOffset(
      clampOffset(
        {
          x: originX + (event.clientX - startX),
          y: originY + (event.clientY - startY),
        },
        scale,
        image
      )
    )
  }

  const endDrag = (event) => {
    if (dragState.current && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragState.current = null
  }

  const handleWheel = (event) => {
    if (!image) return
    event.preventDefault()
    applyZoom(zoom + (event.deltaY < 0 ? 0.15 : -0.15))
  }

  const handleSave = async () => {
    if (!image) return
    setIsSaving(true)
    setError('')

    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')

      // Viewport rect expressed in source-image pixels.
      const sourceX = -offset.x / scale
      const sourceY = -offset.y / scale
      const sourceSize = VIEWPORT / scale

      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      )

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      )
      if (!blob) throw new Error("Couldn't process the image.")
      await onSave(blob)
    } catch (err) {
      setError(err?.message || "Couldn't save the image.")
      setIsSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop avatar"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#171215]/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-[0_24px_48px_-12px_rgba(23,18,21,0.3)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[16px] font-semibold text-[#171215]">
            Adjust your photo
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-[#999999] transition-colors hover:bg-[#F6F8FA] hover:text-[#171215]"
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              size={18}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </button>
        </div>

        <div
          className="relative mx-auto mt-4 cursor-grab touch-none overflow-hidden rounded-xl bg-[#F6F8FA] active:cursor-grabbing"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={handleWheel}
        >
          {image && (
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="max-w-none select-none"
              style={{
                width: image.naturalWidth * scale,
                height: image.naturalHeight * scale,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          {/* Circular mask: a huge box-shadow dims everything outside the
              circle without needing a second overlay element. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/90"
            style={{ boxShadow: '0 0 0 9999px rgba(23, 18, 21, 0.45)' }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => applyZoom(zoom - 0.25)}
            aria-label="Zoom out"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#999999]/35 text-[#171215] transition-colors hover:bg-[#F6F8FA]"
          >
            <HugeiconsIcon icon={MinusSignIcon} size={15} strokeWidth={2.4} />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => applyZoom(Number(event.target.value))}
            aria-label="Zoom"
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[#999999]/30 accent-[#3248F2]"
          />
          <button
            type="button"
            onClick={() => applyZoom(zoom + 0.25)}
            aria-label="Zoom in"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#999999]/35 text-[#171215] transition-colors hover:bg-[#F6F8FA]"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={15} strokeWidth={2.4} />
          </button>
        </div>

        <p className="mt-3 text-center text-[12px] text-[#999999]">
          Drag to reposition · scroll or use the slider to zoom
        </p>

        {error && (
          <p role="alert" className="mt-3 text-center text-[13px] text-[#DC2626]">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[#999999]/35 px-4 py-2 text-[14px] font-medium text-[#171215] transition-colors hover:bg-[#F6F8FA]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!image || isSaving}
            className="flex-1 rounded-lg bg-[#3248F2] px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
