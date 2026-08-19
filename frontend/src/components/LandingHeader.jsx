import { Link } from 'react-router-dom'

export default function LandingHeader({ className = '' }) {
  return (
    <header
      className={`sticky top-0 z-40 h-16 items-center justify-between border-b border-[#999999]/25 bg-white px-4 sm:px-6 lg:px-8 ${className}`}
    >
      <Link to="/" className="flex h-full items-center" aria-label="AIRec — главная">
        <img
          src="/black_logo_icon.png?v=2"
          alt=""
          className="h-[50px] w-auto shrink-0 self-center translate-y-1.5"
          aria-hidden="true"
        />
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/login"
          className="rounded-lg border border-[#999999]/40 bg-white px-4 py-2.5 text-[14px] font-semibold sm:px-[15px] sm:py-[7px] sm:text-[13px] text-[#171215] transition-colors hover:bg-[#F6F8FA]"
        >
          Войти
        </Link>
        <Link
          to="/signup"
          className="rounded-lg bg-[#3248F2] px-4 py-2.5 text-[14px] font-semibold sm:px-[15px] sm:py-[7px] sm:text-[13px] text-white transition-colors hover:bg-[#2839c9]"
        >
          Регистрация
        </Link>
      </div>
    </header>
  )
}
