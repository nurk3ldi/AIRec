import LandingHeader from './LandingHeader'

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-white text-[#171215]">
      <LandingHeader />
      {children}
    </div>
  )
}
