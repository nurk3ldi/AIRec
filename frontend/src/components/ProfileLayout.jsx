import Link from 'next/link'
import { useRouter } from 'next/router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiBrain01Icon,
  Building03Icon,
  CreditCardIcon,
  PuzzleIcon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons'

const SECTIONS = [
  { href: '/profile/account', label: 'Account', icon: UserCircleIcon },
  { href: '/profile/subscription', label: 'Subscription', icon: CreditCardIcon },
  { href: '/profile/ai', label: 'AI Assistant', icon: AiBrain01Icon },
  { href: '/profile/business', label: 'Business', icon: Building03Icon },
  { href: '/profile/features', label: 'Features', icon: PuzzleIcon },
]

/**
 * Two-column settings shell: a text nav rail on the left, the active section on
 * the right. Deliberately card-free — sections are separated by hairline rules
 * instead of boxes, so long forms read as one continuous page.
 */
export default function ProfileLayout({ title, description, children }) {
  const router = useRouter()

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <nav aria-label="Profile settings" className="lg:w-[220px] lg:shrink-0">
          <p className="mb-3 px-3 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#999999]">
            Settings
          </p>
          {/* Horizontal scroll on small screens keeps every section reachable
              without collapsing the rail into a dropdown. */}
          <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((section) => {
              const isActive = router.pathname === section.href
              return (
                <li key={section.href} className="shrink-0 lg:shrink">
                  <Link
                    href={section.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-[14px] transition-colors lg:whitespace-normal ${
                      isActive
                        ? 'bg-[#171215] font-medium text-white'
                        : 'text-[#171215] hover:bg-[#171215]/5'
                    }`}
                  >
                    <HugeiconsIcon
                      icon={section.icon}
                      size={17}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      className="shrink-0"
                    />
                    {section.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <header className="border-b border-[#999999]/25 pb-5">
            {/* h2, not h1: `Header` already owns the page-level h1 ("Profile"),
                and these are sections within it. */}
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[#171215]">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-[14px] text-[#999999]">{description}</p>
            )}
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}
