import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  CreditCardIcon,
  Logout01Icon,
  PencilEdit02Icon,
  Settings02Icon,
  Shield01Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons'
import { logout as logoutRequest, mediaUrl } from '../lib/api'
import { clearTokens, getRefreshToken } from '../lib/auth'
import ProfileAvatar from '../components/ProfileAvatar'
import styles from '../styles/Profile.module.css'

/**
 * The account as a screen, for phones.
 *
 * On a desktop the profile is a popup off the rail's avatar and that is right
 * there — it hangs off the control that opened it and the page behind stays
 * visible. On a phone there is no rail to hang off, and a 264px panel floating
 * over a 390pt viewport is a desktop shape wearing a phone's clothes. So the
 * bottom bar's fifth slot points at this route instead: a real screen, which
 * means the back gesture works and the address is somewhere you can be.
 *
 * It is an ordinary page — it arrives with the same cross-fade every other
 * route does, and the bottom bar stays under it, so leaving is a tap on any of
 * the other four. What it drops is the header: on a phone that bar carries the
 * app's name and a bell, and neither belongs above a screen that is about you.
 *
 * The sections it opens are the ones that behave differently: each rises from
 * the bottom edge as a full-bleed sheet with an ×, over the navigation rather
 * than beside it, because those are forms you went into on purpose.
 *
 * The shape is taken from `design/profile_example.png`: identity centred at the
 * top with an edit badge on the avatar, then **named groups, each one card of
 * several rows** split by hairlines that start after the icon column. Not a
 * card per row — a card is a group, and the label above it is what says why
 * those rows are together. Rows carry their value on the right where they have
 * one, and a second muted line under the label where the value is too long to
 * sit beside it.
 */
export default function ProfilePage() {
  const { user, onOpenSection } = useOutletContext()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      // Best effort: revoke server-side, but sign out locally either way.
      await logoutRequest(refreshToken).catch(() => {})
    }
    clearTokens()
    navigate('/')
  }

  return (
    <div className={styles.page} aria-label="Профиль">
      <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
        {/* Identity, centred. The avatar is the largest thing on the screen
            because it is the one part that says whose account this is. */}
        <div className="flex flex-col items-center pt-1 pb-8">
          <div className="relative">
            <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-[#999999]/20">
              <ProfileAvatar src={mediaUrl(user?.avatar_url)} size={80} />
            </span>
            {/* The badge is the shortcut to the one section that can change the
                picture, sitting on the picture itself — the reference's move,
                and it saves reading three rows to find where photos live. */}
            <button
              type="button"
              onClick={() => onOpenSection('account')}
              aria-label="Изменить профиль"
              className="absolute right-0 bottom-0 grid h-7 w-7 place-items-center rounded-full border-2 border-[#F6F8FA] bg-[#171215] text-white"
            >
              <HugeiconsIcon
                icon={PencilEdit02Icon}
                size={13}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
              />
            </button>
          </div>
          <p className="mt-3 font-display text-[19px] font-semibold tracking-[-0.01em] text-[#171215]">
            {user?.full_name || user?.username || '—'}
          </p>
          {/* The address belongs with the name, not as a row of its own: it
              identifies the account rather than leading anywhere, and a row
              whose only job is to be read is a row you keep tapping by
              mistake. Changing it lives inside «Профиль». */}
          <p className="mt-1 max-w-full truncate text-[14px] text-[#999999]">
            {user?.email || ''}
          </p>
        </div>

        {/* `shrink-0` on nothing here, but the wrapper is `min-h-full`, so the
            `mt-auto` on the sign-out below eats whatever height is left over. */}
        <GroupLabel>Учётная запись</GroupLabel>
        <Card>
          <Row
            icon={UserCircleIcon}
            label="Профиль"
            onClick={() => onOpenSection('account')}
          />
          <Row
            icon={Shield01Icon}
            label="Безопасность"
            onClick={() => onOpenSection('security')}
          />
        </Card>

        <GroupLabel>Подписка</GroupLabel>
        <Card>
          <Row
            icon={CreditCardIcon}
            label="Тариф"
            value="Бесплатный"
            onClick={() => onOpenSection('subscription')}
          />
        </Card>

        <GroupLabel>Приложение</GroupLabel>
        <Card>
          <Row
            icon={Settings02Icon}
            label="Настройки"
            onClick={() => onOpenSection('settings')}
          />
        </Card>

        {/* `mt-auto` pushes it to the bottom edge; the `pt-12` is a floor under
            that, so the gap survives a screen too short for the auto margin to
            have anything left to give. Sign-out is the one thing here you
            cannot undo by pressing back, and that space is what keeps a thumb
            travelling down the list from arriving on it. */}
        <div className="mt-auto flex flex-col pt-12">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-3.5 rounded-2xl bg-white px-5 py-4 text-left text-[#DC2626] transition-colors active:bg-[#DC2626]/6 disabled:opacity-60"
        >
          <HugeiconsIcon
            icon={Logout01Icon}
            size={20}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.9}
            className="shrink-0"
          />
          <span className="text-[15px] font-medium">
            {signingOut ? 'Выходим…' : 'Выйти'}
          </span>
        </button>
        </div>
      </div>
    </div>
  )
}

/** The name above a group. Muted and small — it labels the card below it, it is
 *  not a heading competing with the rows inside. */
function GroupLabel({ children }) {
  return (
    <p className="mt-7 mb-2 px-1.5 text-[13px] font-medium text-[#999999]">
      {children}
    </p>
  )
}

/** One group: rows in a single card, hairlines between them. */
function Card({ children }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white">{children}</section>
  )
}

/**
 * A row inside a group.
 *
 * The hairline starts at the label, not at the card's edge, so the icon column
 * reads as one strip running down the group instead of being chopped up by
 * every line. The reference does the same, and it is most of what makes a stack
 * of rows look like one object rather than several stacked.
 *
 * It sits on this row's own top border and `first:border-t-0` clears it on the
 * first one, so a group of any length has lines only *between* its rows.
 */
function Row({ icon, label, value, detail, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 px-5 text-left transition-colors active:bg-[#F6F8FA]"
    >
      <HugeiconsIcon
        icon={icon}
        size={20}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
        className="shrink-0 text-[#171215]"
      />

      <span className="flex min-w-0 flex-1 items-center gap-3 border-t border-[#999999]/15 py-4 group-first:border-t-0">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-[#171215]">
            {label}
          </span>
          {detail && (
            <span className="mt-0.5 block truncate text-[14px] text-[#999999]">
              {detail}
            </span>
          )}
        </span>

        {value && (
          <span className="shrink-0 text-[15px] text-[#999999]">{value}</span>
        )}

        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={18}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          className="shrink-0 text-[#999999]"
        />
      </span>
    </button>
  )
}
