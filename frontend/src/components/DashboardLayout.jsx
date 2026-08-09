import { useRequireAuth } from '../lib/auth'
import Sidebar from './Sidebar'
import Header from './Header'

export default function DashboardLayout({ children }) {
  const isReady = useRequireAuth()

  if (!isReady) return null

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#171215]">
      <Sidebar />
      <main className="min-h-screen bg-[#F6F8FA] pl-16">
        <Header />
        {children}
      </main>
    </div>
  )
}
