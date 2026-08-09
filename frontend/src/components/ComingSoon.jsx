/** Placeholder body for settings sections whose backend doesn't exist yet. */
export default function ComingSoon({ children }) {
  return (
    <div className="py-16 text-center">
      <p className="text-[15px] font-medium text-[#171215]">Coming soon</p>
      <p className="mx-auto mt-1.5 max-w-[420px] text-[14px] text-[#999999]">
        {children}
      </p>
    </div>
  )
}
