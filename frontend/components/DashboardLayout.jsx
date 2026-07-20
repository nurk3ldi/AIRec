import Sidebar from './Sidebar'

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-white text-[#171215]">
      <Sidebar />
      <main className="min-h-screen bg-white pl-16">{children}</main>
    </div>
  )
}
