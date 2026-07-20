import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { User02Icon } from '@hugeicons/core-free-icons'

export default function ProfileAvatar({ src }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const hasProfileImage = Boolean(src) && failedSrc !== src

  if (hasProfileImage) {
    return (
      <img
        src={src}
        alt=""
        className="h-7 w-7 rounded-full object-cover"
        onError={() => setFailedSrc(src)}
      />
    )
  }

  return (
    <HugeiconsIcon
      icon={User02Icon}
      size={17}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
    />
  )
}
