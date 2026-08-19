import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { User02Icon } from '@hugeicons/core-free-icons'

/**
 * `size` is the box in pixels. Two shells show this at different scales — 32 in
 * the desktop rail, 22 in the phone's bottom bar — and the image has to be told,
 * since `object-cover` on a fixed `h-8` would simply overflow the smaller slot.
 */
export default function ProfileAvatar({ src, size = 32 }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const hasProfileImage = Boolean(src) && failedSrc !== src

  if (hasProfileImage) {
    return (
      <img
        src={src}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
        onError={() => setFailedSrc(src)}
      />
    )
  }

  return (
    <HugeiconsIcon
      icon={User02Icon}
      size={Math.round(size * 0.62)}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
    />
  )
}
