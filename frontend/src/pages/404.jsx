import { Link } from 'react-router-dom'

/**
 * Next.js served a built-in page for unmatched URLs; a router has none, so this
 * is the first time the app has actually had one written.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6">
      <div className="text-center">
        <p className="font-display text-[64px] leading-none font-semibold tracking-[-0.03em] text-accent">
          404
        </p>
        <h1 className="font-display mt-6 text-[24px] font-semibold tracking-[-0.02em] text-ink">
          Страница не найдена
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          Возможно, ссылка устарела или в адресе опечатка.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-lg bg-accent px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-accent-strong"
        >
          На главную
        </Link>
      </div>
    </div>
  )
}
