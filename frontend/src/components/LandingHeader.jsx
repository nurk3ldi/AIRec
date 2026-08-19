import { Link } from 'react-router-dom'

export default function LandingHeader({ className = '' }) {
  return (
    <header
      className={`sticky top-0 z-40 h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6 lg:px-8 ${className}`}
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
          className="rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-[14px] font-semibold sm:px-[15px] sm:py-[7px] sm:text-[13px] text-ink transition-colors hover:bg-ground"
        >
          Войти
        </Link>
        <Link
          to="/signup"
          className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold sm:px-[15px] sm:py-[7px] sm:text-[13px] text-white transition-colors hover:bg-accent-strong"
        >
          Регистрация
        </Link>
      </div>
    </header>
  )
}
