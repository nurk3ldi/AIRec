/**
 * Shared shell for the `/profile/*` pages: centred column, page heading, and a
 * hairline rule under it. Deliberately card-free — content rows below the rule
 * separate with their own borders so a long form reads as one continuous page.
 *
 * There's no nav here on purpose: moving between sections is the job of the
 * sidebar's `ProfileMenu` popup.
 */
export default function ProfileSection({ title, description, children }) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="border-b border-[#999999]/25 pb-5">
        <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[#171215]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[14px] text-[#999999]">{description}</p>
        )}
      </header>
      {children}
    </div>
  )
}
