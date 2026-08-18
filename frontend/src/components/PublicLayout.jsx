import { Outlet } from 'react-router-dom'
import LandingHeader from './LandingHeader'

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-white text-[#171215]">
      <LandingHeader />
      <Outlet />
    </div>
  )
}
