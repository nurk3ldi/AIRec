import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { applyTheme, getThemePreference } from './lib/theme'
import { applyLanguage } from './lib/i18n'
import DashboardLayout from './components/DashboardLayout'
import PublicLayout from './components/PublicLayout'
import AppointmentsPage from './pages/appointments'
import BusinessPage from './pages/business'
import DashboardPage from './pages/dashboard'
import ForgotPasswordPage from './pages/forgot-password'
import InboxPage from './pages/inbox'
import LandingPage from './pages/index'
import LoginPage from './pages/login'
import NotFoundPage from './pages/404'
import NotificationsPage from './pages/notifications'
import ProfilePage from './pages/profile'
import ResetPasswordPage from './pages/reset-password'
import SignupPage from './pages/signup'

/**
 * Every route in the app, and which shell it renders inside.
 *
 * This replaces two things Next.js did from the filesystem: the route table
 * itself, and `_app.jsx`'s `PUBLIC_ROUTES` set. **The split is the same one**
 * — a marketing header with no sidebar for anything logged-out, the
 * authenticated shell for everything else — but it is now stated as structure
 * rather than as a lookup, so a route physically cannot be added without
 * choosing a shell for it.
 *
 * Nested routes with a layout element and `<Outlet/>` are what make that true;
 * see `PublicLayout` and `DashboardLayout`, which render the outlet where they
 * used to render `children`.
 */
export default function App() {
  // The inline script in `index.html` sets the theme before first paint; this
  // keeps it right *afterwards*. On «Системная» — the default — a phone going
  // dark at sunset should take the app with it, and the settings panel that
  // otherwise owns this is closed almost all of the time.
  useEffect(() => {
    // The language needs no pre-paint script the way the theme does — the store
    // reads `localStorage` at module load, so the first render is already in the
    // right language. This only stamps `<html lang>`, which is what a screen
    // reader picks its voice from.
    applyLanguage()

    const media = globalThis.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (getThemePreference() === 'system') applyTheme('system')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/business" element={<BusinessPage />} />
        {/* Not linked to on a desktop — the rail opens the popup instead —
            but a real route all the same, because the phone's bottom bar
            points at it and a back gesture has to have somewhere to go. */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>

      {/* Next.js served `pages/404.jsx` for anything unmatched; a router has to
          be told. Inside the public shell, because an unknown URL is most often
          reached by someone who is not signed in. */}
      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
