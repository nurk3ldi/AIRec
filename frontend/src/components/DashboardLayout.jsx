import { useEffect, useState } from 'react'
import { useRequireAuth } from '../lib/auth'
import Sidebar from './Sidebar'
import Header from './Header'
import PageTransition from './PageTransition'

export default function DashboardLayout() {
  const verifiedUser = useRequireAuth()
  // Mirrored into state so edits made in the profile dialog (name, avatar)
  // show up in the sidebar without another `/auth/me` round trip.
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (verifiedUser) setUser(verifiedUser)
  }, [verifiedUser])

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#171215]">
      <Sidebar user={user} onUserChange={setUser} />
      <main className="min-h-screen bg-[#F6F8FA] pl-16">
        <Header />
        {/* The rail and the header sit outside this and update instantly — a
            click should be acknowledged now; only the content it swaps needs
            to cross over. */}
        <PageTransition />
      </main>
    </div>
  )
}
