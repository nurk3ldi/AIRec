import { Link, useLocation } from 'react-router-dom'

/**
 * The public header: the mark on the left, the way in on the right.
 *
 * Each auth page drops the button pointing at itself — a control offering the
 * page you are already standing on cannot do anything. `/login` keeps only
 * «Регистрация», `/signup` keeps only «Войти».
 *
 * «Регистрация» keeps the **filled** style everywhere, matching the reference's
 * Sign Up: the inverted button, ink-on-surface flipped, which on a black page
 * is white with black text and on a white one is black with white text. It was
 * briefly outlined here on the theory that it should not compete with the
 * page's own «Войти»; the reference does not make that concession, and the two
 * are far enough apart on screen that it does not need to.
 */
// Measured off the reference's header controls: 32px tall, 12px of horizontal
// padding, 14px text at weight 500, a 6px radius and a 150ms transition. The
// height is `sm:` only — below that the header shows on the two mid-flow reset
// pages, where 32px is under the touch minimum, so it stays 40 there.
const SIZE =
  'grid place-items-center rounded-md px-4 text-[14px] font-medium ' +
  'h-10 sm:h-8 sm:px-3 transition-colors duration-150'
// The hover fill is `ink` at an alpha, not `ground`: on the dark theme the page
// and the surface are both pure black, so `hover:bg-ground` changed nothing at
// all. An ink tint lifts on black and darkens on white — one class, both
// themes. The edge brightens with it, which is what the reference does.
const SECONDARY =
  'border border-line-strong bg-surface text-ink hover:border-field-focus hover:bg-ink/8'
// The inverted button: `accent` is white on the dark theme and black on the
// light one, and the label takes `surface`, which is the opposite of whichever
// it is. Not a fixed white — a white button on a white page would be a shape
// nobody can see. It needs no edge; the fill is already the strongest contrast
// the page has.
const PRIMARY = 'bg-accent text-surface hover:bg-accent-strong'

export default function LandingHeader({ className = '' }) {
  const { pathname } = useLocation()
  const onLogin = pathname === '/login'
  const onSignup = pathname === '/signup'

  return (
    <header
      className={`sticky top-0 z-40 h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {/* Two files, one shown at a time. A theme cannot swap an `<img src>` in
          CSS, and the mark is a bitmap rather than a glyph that could inherit
          `currentColor` — so both are rendered and the variant picks.

          `white_logo_icon.png` was cut to `black_logo_icon.png`'s exact canvas
          and padding, so both take the same classes. The white master
          (`airec_logo.png`) is 1024² with the mark off-centre inside it, which
          rendered a third smaller and sat 14px low; correcting that in CSS
          would have meant two sets of offsets to keep in step forever. */}
      <Link to="/" className="flex h-full items-center" aria-label="AIRec — главная">
        <img
          src="/black_logo_icon.png?v=2"
          alt=""
          aria-hidden="true"
          className="h-[50px] w-auto shrink-0 translate-y-2.5 self-center dark:hidden"
        />
        <img
          src="/white_logo_icon.png"
          alt=""
          aria-hidden="true"
          className="hidden h-[50px] w-auto shrink-0 translate-y-2.5 self-center dark:block"
        />
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        {!onLogin && (
          <Link to="/login" className={`${SIZE} ${SECONDARY}`}>
            Войти
          </Link>
        )}
        {!onSignup && (
          <Link to="/signup" className={`${SIZE} ${PRIMARY}`}>
            Регистрация
          </Link>
        )}
      </div>
    </header>
  )
}
