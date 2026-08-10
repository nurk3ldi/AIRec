import Link from 'next/link'

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#999999]/25 bg-white px-4 sm:px-6 lg:px-8">
      <Link href="/" className="flex h-full items-center" aria-label="AIRec — главная">
        <img
          src="/black_logo_icon.png?v=2"
          alt=""
          className="h-[50px] w-auto shrink-0 self-center translate-y-1.5"
          aria-hidden="true"
        />
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-[#999999]/40 bg-white px-[15px] py-[7px] text-[13px] font-semibold text-[#171215] transition-colors hover:bg-[#F6F8FA]"
        >
          Войти
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-[#3248F2] px-[15px] py-[7px] text-[13px] font-semibold text-white transition-colors hover:bg-[#2839c9]"
        >
          Регистрация
        </Link>
      </div>
    </header>
  )
}
